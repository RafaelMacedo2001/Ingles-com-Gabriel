import { getServiceConfig } from "./server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] || character);
}

export async function sendAccountInvitation(request: Request, account: { name: string; email: string; role: "student" | "admin"; expiresAt?: string }) {
  const config = await getServiceConfig();
  if (!config.resendApiKey || !config.emailFrom) {
    return { sent: false, reason: "O serviço de e-mail ainda não está configurado." };
  }
  const appUrl = config.appUrl || new URL(request.url).origin;
  const activationUrl = `${appUrl}/?first_access=${encodeURIComponent(account.email)}`;
  const isAdmin = account.role === "admin";
  const accessDescription = isAdmin
    ? "Seu acesso ao painel de gestão foi liberado."
    : `Seu acesso às aulas de inglês foi liberado até <strong>${new Date(account.expiresAt || "").toLocaleDateString("pt-BR", { timeZone: "UTC" })}</strong>.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [account.email],
      subject: isAdmin ? "Seu acesso de gestor ao Inglês com Gabriel está pronto" : "Seu acesso ao Inglês com Gabriel está pronto",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0b1f41;border-top:6px solid #e3343f;padding-top:24px"><h1 style="color:#1557d6">Bem-vindo ao Inglês com Gabriel</h1><p>Olá, ${escapeHtml(account.name)}!</p><p>${accessDescription}</p><p>No primeiro acesso, você criará sua senha pessoal.</p><p style="margin:28px 0"><a href="${activationUrl}" style="background:#1557d6;color:white;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:bold">Criar minha senha</a></p><p style="font-size:12px;color:#68758a">Se o botão não abrir, copie este endereço: ${activationUrl}</p></div>`,
    }),
  });
  if (!response.ok) return { sent: false, reason: "A conta foi cadastrada, mas o provedor recusou o envio do convite." };
  return { sent: true, reason: null };
}

export async function sendStudentInvitation(request: Request, student: { name: string; email: string; expiresAt: string }) {
  return sendAccountInvitation(request, { ...student, role: "student" });
}
