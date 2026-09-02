import { ensureDatabase, json, requireRole, runtime } from "../../lib/server";

export async function GET(request: Request) {
  const session = await requireRole(request, "student");
  if (!session) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const result = await runtime.DB.prepare(`SELECT lesson_id, lesson_title, watched_at
    FROM lesson_progress WHERE student_id = ? ORDER BY watched_at DESC`).bind(session.id).all();
  return json({ progress: result.results });
}

export async function POST(request: Request) {
  const session = await requireRole(request, "student");
  if (!session) return json({ error: "Não autorizado." }, 401);
  const body = await request.json() as { lessonId?: string; lessonTitle?: string };
  const lessonId = String(body.lessonId || "").trim();
  const lessonTitle = String(body.lessonTitle || "").trim();
  if (!lessonId || !lessonTitle) return json({ error: "Aula inválida." }, 400);
  await ensureDatabase();
  await runtime.DB.prepare(`INSERT INTO lesson_progress (student_id, lesson_id, lesson_title, watched_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, lesson_id) DO UPDATE SET lesson_title = excluded.lesson_title, watched_at = CURRENT_TIMESTAMP`)
    .bind(session.id, lessonId, lessonTitle).run();
  return json({ ok: true });
}
