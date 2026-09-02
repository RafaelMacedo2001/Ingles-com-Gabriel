import { ensureDatabase, json, requireRole, runtime } from "../../../lib/server";

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { id } = await context.params;
  const body = await request.json() as { weekday?: number; startTime?: string; title?: string; details?: string };
  const weekday = Number(body.weekday);
  const startTime = String(body.startTime || "").trim();
  const title = String(body.title || "").trim();
  const details = String(body.details || "").trim();
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return json({ error: "Selecione um dia válido." }, 400);
  if (!validTime(startTime)) return json({ error: "Informe um horário válido." }, 400);
  if (!title) return json({ error: "Informe o nome da aula." }, 400);
  await ensureDatabase();
  const result = await runtime.DB.prepare(`UPDATE schedule_entries SET weekday = ?, start_time = ?, title = ?, details = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(weekday, startTime, title, details, id).run();
  if (!result.meta.changes) return json({ error: "Horário não encontrado." }, 404);
  return json({ entry: { id, weekday, start_time: startTime, title, details } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { id } = await context.params;
  await ensureDatabase();
  await runtime.DB.prepare("DELETE FROM schedule_entries WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
