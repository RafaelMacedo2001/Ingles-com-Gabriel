import { ensureDatabase, getServiceConfig, json, requireRole, saveServiceConfig } from "../../lib/server";

export async function GET(request: Request) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const config = await getServiceConfig();
  return json({
    email: { configured: Boolean(config.resendApiKey && config.emailFrom), emailFrom: config.emailFrom, appUrl: config.appUrl, hasApiKey: Boolean(config.resendApiKey) },
    drive: { configured: Boolean(config.googleClientEmail && config.googlePrivateKey && config.googleDriveFolderId), clientEmail: config.googleClientEmail, folderId: config.googleDriveFolderId, hasPrivateKey: Boolean(config.googlePrivateKey) },
    payment: { configured: Boolean(config.mercadoPagoAccessToken), hasAccessToken: Boolean(config.mercadoPagoAccessToken), hasWebhookSecret: Boolean(config.mercadoPagoWebhookSecret), title: config.courseCheckoutTitle, price: config.courseCheckoutPrice },
  });
}

export async function POST(request: Request) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const body = await request.json() as Partial<{
    resendApiKey: string; emailFrom: string; appUrl: string;
    googleClientEmail: string; googlePrivateKey: string; googleDriveFolderId: string;
    mercadoPagoAccessToken: string; mercadoPagoWebhookSecret: string; courseCheckoutTitle: string; courseCheckoutPrice: string;
  }>;
  await saveServiceConfig(body);
  const config = await getServiceConfig();
  return json({
    ok: true,
    emailConfigured: Boolean(config.resendApiKey && config.emailFrom),
    driveConfigured: Boolean(config.googleClientEmail && config.googlePrivateKey && config.googleDriveFolderId),
    paymentConfigured: Boolean(config.mercadoPagoAccessToken),
  });
}
