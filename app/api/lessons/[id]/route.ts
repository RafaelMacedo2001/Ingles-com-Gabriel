import { ensureDatabase, json, requireRole, runtime } from "../../../lib/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { id } = await context.params;
  const { title = "", level = "" } = await request.json() as { title?: string; level?: string };
  if (!title.trim() || !level.trim()) return json({ error: "Informe título e nível." }, 400);
  await ensureDatabase();
  await runtime.DB.prepare(`INSERT INTO lesson_metadata (file_id, title, level, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(file_id) DO UPDATE SET title = excluded.title, level = excluded.level, updated_at = CURRENT_TIMESTAMP`
  ).bind(id, title.trim(), level.trim()).run();
  return json({ ok: true, id, title: title.trim(), level: level.trim() });
}
