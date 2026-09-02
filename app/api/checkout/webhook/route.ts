import { sendStudentInvitation } from "../../../lib/invitations";
import { ensureDatabase, getServiceConfig, json, oneYearFromNow, runtime } from "../../../lib/server";

type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
};

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function signatureParts(value: string) {
  return Object.fromEntries(value.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
}

async function validWebhookSignature(request: Request, secret: string, dataId: string) {
  if (!secret) return true;
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = signatureParts(signature);
  if (!parts.ts || !parts.v1 || !requestId || !dataId) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  return expected.length === parts.v1.length && expected.split("").every((char, index) => char === parts.v1[index]);
}

export async function POST(request: Request) {
  await ensureDatabase();
  const config = await getServiceConfig();
  if (!config.mercadoPagoAccessToken) return json({ ok: true });

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as { type?: string; action?: string; data?: { id?: string | number } };
  const dataId = String(url.searchParams.get("data.id") || url.searchParams.get("id") || body.data?.id || "");
  if (!dataId) return json({ ok: true });
  if (!(await validWebhookSignature(request, config.mercadoPagoWebhookSecret, dataId))) return json({ error: "Assinatura inválida." }, 401);

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${config.mercadoPagoAccessToken}` },
  });
  if (!paymentResponse.ok) return json({ ok: true });
  const payment = await paymentResponse.json() as MercadoPagoPayment;
  const orderId = payment.external_reference || "";
  if (!orderId) return json({ ok: true });

  const order = await runtime.DB.prepare("SELECT * FROM checkout_orders WHERE id = ? LIMIT 1").bind(orderId)
    .first<{ id: string; status: string; name: string; email: string; phone: string; student_id: string | null }>();
  if (!order) return json({ ok: true });

  await runtime.DB.prepare("UPDATE checkout_orders SET payment_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(String(payment.id), payment.status, order.id).run();
  if (payment.status !== "approved" || order.status === "approved") return json({ ok: true });

  const expiresAt = oneYearFromNow();
  const existing = await runtime.DB.prepare("SELECT id, password_hash FROM students WHERE lower(email) = ? LIMIT 1")
    .bind(order.email).first<{ id: string; password_hash: string | null }>();
  const studentId = existing?.id || crypto.randomUUID();
  if (existing) {
    await runtime.DB.prepare("UPDATE students SET name = ?, phone = ?, expires_at = ?, renewal_count = renewal_count + 1 WHERE id = ?")
      .bind(order.name, order.phone, expiresAt, existing.id).run();
  } else {
    await runtime.DB.prepare("INSERT INTO students (id, name, email, phone, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(studentId, order.name, order.email, order.phone, expiresAt).run();
  }
  await runtime.DB.prepare("UPDATE checkout_orders SET status = 'approved', student_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(studentId, order.id).run();

  if (!existing?.password_hash) await sendStudentInvitation(request, { name: order.name, email: order.email, expiresAt });
  return json({ ok: true });
}
