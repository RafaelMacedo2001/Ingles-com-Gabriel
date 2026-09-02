import { ensureDatabase, json, readSession, runtime } from "../../lib/server";

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return json({ authenticated: false }, 401);
  await ensureDatabase();
  if (session.role === "admin") {
    const admin = await runtime.DB.prepare("SELECT name FROM admins WHERE id = ? LIMIT 1")
      .bind(session.id).first<{ name: string }>();
    return json({ authenticated: true, ...session, name: admin?.name });
  }
  const student = await runtime.DB.prepare("SELECT name, expires_at FROM students WHERE id = ? LIMIT 1")
    .bind(session.id).first<{ name: string; expires_at: string }>();
  if (!student || new Date(student.expires_at).getTime() < Date.now()) return json({ authenticated: false }, 401);
  return json({ authenticated: true, ...session, name: student.name, expiresAt: student.expires_at });
}
