import { ensureDatabase, json, normalizePhone, requireRole, runtime } from "../../lib/server";
import { sendStudentInvitation } from "../../lib/invitations";

export async function GET(request: Request) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const result = await runtime.DB.prepare(
    `SELECT students.id, students.name, students.email, students.phone, students.expires_at, students.created_at,
      students.last_access_at, students.renewal_count, students.password_hash IS NOT NULL AS activated,
      (SELECT COUNT(*) FROM access_events WHERE access_events.student_id = students.id) AS access_count
      FROM students ORDER BY students.expires_at ASC`,
  ).all();
  const weekStart = new Date();
  const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  const [total, active, expired, expiring, renewed, accesses] = await Promise.all([
    runtime.DB.prepare("SELECT COUNT(*) AS total FROM students").first<{ total: number }>(),
    runtime.DB.prepare("SELECT COUNT(*) AS total FROM students WHERE datetime(expires_at) >= datetime('now')").first<{ total: number }>(),
    runtime.DB.prepare("SELECT COUNT(*) AS total FROM students WHERE datetime(expires_at) < datetime('now')").first<{ total: number }>(),
    runtime.DB.prepare("SELECT COUNT(*) AS total FROM students WHERE datetime(expires_at) >= datetime('now') AND datetime(expires_at) <= datetime('now', '+7 days')").first<{ total: number }>(),
    runtime.DB.prepare("SELECT COUNT(*) AS total FROM students WHERE renewal_count > 0").first<{ total: number }>(),
    runtime.DB.prepare("SELECT COUNT(*) AS total FROM access_events WHERE datetime(accessed_at) >= datetime(?)").bind(weekStart.toISOString()).first<{ total: number }>(),
  ]);
  return json({ students: result.results, stats: { total: total?.total || 0, active: active?.total || 0, expired: expired?.total || 0, expiring: expiring?.total || 0, renewed: renewed?.total || 0, weeklyAccesses: accesses?.total || 0 } });
}

export async function POST(request: Request) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { name = "", email = "", phone = "", expiresAt = "" } = await request.json() as { name?: string; email?: string; phone?: string; expiresAt?: string };
  const normalizedPhone = normalizePhone(phone);
  if (!name.trim() || !email.includes("@") || !normalizedPhone || !expiresAt) return json({ error: "Preencha nome, e-mail, telefone válido e validade." }, 400);
  await ensureDatabase();
  const id = crypto.randomUUID();
  try {
    await runtime.DB.prepare("INSERT INTO students (id, name, email, phone, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, name.trim(), email.trim().toLowerCase(), normalizedPhone, expiresAt).run();
  } catch {
    return json({ error: "Já existe um aluno com este e-mail." }, 409);
  }
  const normalizedStudent = { name: name.trim(), email: email.trim().toLowerCase(), expiresAt };
  const invitation = await sendStudentInvitation(request, normalizedStudent);
  return json({ id, name: normalizedStudent.name, email: normalizedStudent.email, phone: normalizedPhone, expires_at: expiresAt, activated: 0, invitationSent: invitation.sent, invitationMessage: invitation.reason }, 201);
}
