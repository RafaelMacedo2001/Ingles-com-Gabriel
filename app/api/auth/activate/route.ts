import { createSessionCookie, ensureDatabase, hashPassword, json, runtime } from "../../../lib/server";

export async function POST(request: Request) {
  const { email = "", password = "" } = await request.json() as { email?: string; password?: string };
  const normalizedEmail = email.trim().toLowerCase();
  if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
  await ensureDatabase();
  const student = await runtime.DB.prepare(
    "SELECT id, name, email, password_hash, expires_at FROM students WHERE lower(email) = ? LIMIT 1",
  ).bind(normalizedEmail).first<{ id: string; name: string; email: string; password_hash: string | null; expires_at: string }>();
  if (!student) return json({ error: "Cadastro não encontrado." }, 404);
  if (student.password_hash) return json({ error: "Sua senha já foi definida. Use a tela de acesso." }, 409);
  if (new Date(student.expires_at).getTime() < Date.now()) return json({ error: "Este convite expirou." }, 403);
  const passwordHash = await hashPassword(password);
  await runtime.DB.prepare("UPDATE students SET password_hash = ?, last_access_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(passwordHash, student.id).run();
  await runtime.DB.prepare("INSERT INTO access_events (student_id) VALUES (?)").bind(student.id).run();
  const cookie = await createSessionCookie({ role: "student", id: student.id, email: student.email });
  return json({ role: "student", email: student.email, name: student.name, expiresAt: student.expires_at }, 200, { "set-cookie": cookie });
}
