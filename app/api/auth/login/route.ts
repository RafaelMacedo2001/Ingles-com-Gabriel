import { createSessionCookie, ensureDatabase, json, runtime, verifyPassword } from "../../../lib/server";

export async function POST(request: Request) {
  const { email = "", password = "" } = await request.json() as { email?: string; password?: string };
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return json({ error: "Informe e-mail e senha." }, 400);

  if (runtime.ADMIN_EMAIL && normalizedEmail === runtime.ADMIN_EMAIL.toLowerCase()) {
    if (password !== runtime.ADMIN_PASSWORD) return json({ error: "Credenciais inválidas." }, 401);
    const cookie = await createSessionCookie({ role: "admin", id: "admin", email: normalizedEmail });
    return json({ role: "admin", email: normalizedEmail }, 200, { "set-cookie": cookie });
  }

  await ensureDatabase();
  const admin = await runtime.DB.prepare(
    "SELECT id, name, email, password_hash FROM admins WHERE lower(email) = ? LIMIT 1",
  ).bind(normalizedEmail).first<{ id: string; name: string; email: string; password_hash: string | null }>();

  if (admin) {
    if (!admin.password_hash) return json({ needsActivation: true, email: admin.email }, 409);
    if (!(await verifyPassword(password, admin.password_hash))) return json({ error: "Credenciais inválidas." }, 401);
    await runtime.DB.prepare("UPDATE admins SET last_access_at = CURRENT_TIMESTAMP WHERE id = ?").bind(admin.id).run();
    const cookie = await createSessionCookie({ role: "admin", id: admin.id, email: admin.email });
    return json({ role: "admin", email: admin.email, name: admin.name }, 200, { "set-cookie": cookie });
  }

  const student = await runtime.DB.prepare(
    "SELECT id, name, email, password_hash, expires_at FROM students WHERE lower(email) = ? LIMIT 1",
  ).bind(normalizedEmail).first<{ id: string; name: string; email: string; password_hash: string | null; expires_at: string }>();

  if (!student) return json({ error: "Cadastro não encontrado." }, 404);
  if (new Date(student.expires_at).getTime() < Date.now()) return json({ error: "Seu acesso expirou. Fale com a equipe para renovar." }, 403);
  if (!student.password_hash) return json({ needsActivation: true, email: student.email }, 409);
  if (!(await verifyPassword(password, student.password_hash))) return json({ error: "Credenciais inválidas." }, 401);

  await runtime.DB.prepare("UPDATE students SET last_access_at = CURRENT_TIMESTAMP WHERE id = ?").bind(student.id).run();
  await runtime.DB.prepare("INSERT INTO access_events (student_id) VALUES (?)").bind(student.id).run();
  const cookie = await createSessionCookie({ role: "student", id: student.id, email: student.email });
  return json({ role: "student", email: student.email, name: student.name, expiresAt: student.expires_at }, 200, { "set-cookie": cookie });
}
