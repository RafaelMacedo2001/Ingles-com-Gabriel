import { ensureDatabase, getServiceConfig, json, runtime } from "../../../lib/server";

export async function POST(request: Request) {
  if (!runtime.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${runtime.CRON_SECRET}`) {
    return json({ error: "Não autorizado." }, 401);
  }
  await ensureDatabase();
  const config = await getServiceConfig();
  const expiring = await runtime.DB.prepare(`
    SELECT id, name, email, expires_at FROM students
    WHERE date(expires_at) BETWEEN date('now') AND date('now', '+7 days')
    AND id NOT IN (SELECT student_id FROM expiration_notices WHERE notice_type = 'seven_days')
  `).all<{ id: string; name: string; email: string; expires_at: string }>();
  let notified = 0;
  if (config.resendApiKey && config.emailFrom) {
    for (const student of expiring.results) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: config.emailFrom,
          to: [student.email],
          subject: "Seu acesso às aulas termina em breve",
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0b1f41;border-top:6px solid #e3343f;padding-top:24px"><h1 style="color:#1557d6">Inglês com Gabriel</h1><p>Olá, ${student.name}!</p><p>Seu acesso às aulas de inglês termina em <strong>${new Date(student.expires_at).toLocaleDateString("pt-BR")}</strong>.</p><p>Fale com a equipe para renovar e continuar estudando.</p></div>`,
        }),
      });
      if (response.ok) {
        await runtime.DB.prepare("INSERT OR IGNORE INTO expiration_notices (student_id, notice_type) VALUES (?, 'seven_days')").bind(student.id).run();
        notified++;
      }
    }
  }
  const expired = await runtime.DB.prepare("SELECT COUNT(*) AS total FROM students WHERE datetime(expires_at) < datetime('now')").first<{ total: number }>();
  return json({ notified, expired: expired?.total || 0 });
}
