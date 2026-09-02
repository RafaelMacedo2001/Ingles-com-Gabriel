import { ensureDatabase, getServiceConfig, json, normalizePhone, runtime } from "../../lib/server";

function mercadoPagoPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length >= 10) return { area_code: local.slice(0, 2), number: local.slice(2) };
  return { number: digits };
}

export async function POST(request: Request) {
  await ensureDatabase();
  const config = await getServiceConfig();
  if (!config.mercadoPagoAccessToken) return json({ error: "Mercado Pago ainda não configurado." }, 503);

  const { name = "", email = "", phone = "" } = await request.json() as { name?: string; email?: string; phone?: string };
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);
  const price = Number(String(config.courseCheckoutPrice || "0").replace(",", "."));
  if (!normalizedName || !normalizedEmail.includes("@") || !normalizedPhone) return json({ error: "Informe nome, e-mail e telefone válido." }, 400);
  if (!Number.isFinite(price) || price <= 0) return json({ error: "Valor do curso inválido nas configurações." }, 400);

  const orderId = crypto.randomUUID().replace(/-/g, "");
  const origin = config.appUrl || new URL(request.url).origin;
  const title = config.courseCheckoutTitle || "Inglês com Gabriel - Acesso anual";
  const preferencePayload = {
    items: [{ id: "ingles-com-gabriel-anual", title, quantity: 1, currency_id: "BRL", unit_price: price }],
    payer: { name: normalizedName, email: normalizedEmail, phone: mercadoPagoPhone(normalizedPhone) },
    back_urls: {
      success: `${origin}/?purchase=success&email=${encodeURIComponent(normalizedEmail)}`,
      pending: `${origin}/?purchase=pending&email=${encodeURIComponent(normalizedEmail)}`,
      failure: `${origin}/?purchase=failure`,
    },
    auto_return: "approved",
    notification_url: `${origin}/api/checkout/webhook`,
    external_reference: orderId,
    metadata: { buyer_name: normalizedName, buyer_email: normalizedEmail, buyer_phone: normalizedPhone },
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.mercadoPagoAccessToken}`, "content-type": "application/json" },
    body: JSON.stringify(preferencePayload),
  });
  const preference = await response.json() as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };
  if (!response.ok || !preference.id || !preference.init_point) return json({ error: preference.message || "Não foi possível iniciar o checkout." }, 502);

  await runtime.DB.prepare(`INSERT INTO checkout_orders (id, preference_id, status, name, email, phone, amount, checkout_url)
    VALUES (?, ?, 'created', ?, ?, ?, ?, ?)`)
    .bind(orderId, preference.id, normalizedName, normalizedEmail, normalizedPhone, price, preference.init_point).run();

  return json({ checkoutUrl: preference.init_point, orderId });
}
