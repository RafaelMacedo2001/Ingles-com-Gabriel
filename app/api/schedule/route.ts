import { ensureDatabase, json, readSession, requireRole, runtime } from "../../lib/server";

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET(request: Request) {
  if (!(await readSession(request))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const result = await runtime.DB.prepare(`SELECT id, weekday, start_time, title, details, created_at, updated_at
    FROM schedule_entries ORDER BY weekday ASC, start_time ASC, created_at ASC`).all();
  return json({ entries: result.results });
}

export async function POST(request: Request) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const body = await request.json() as { weekday?: number; startTime?: string; title?: string; details?: string };
  const weekday = Number(body.weekday);
  const startTime = String(body.startTime || "").trim();
  const title = String(body.title || "").trim();
  const details = String(body.details || "").trim();
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return json({ error: "Selecione um dia válido." }, 400);
  if (!validTime(startTime)) return json({ error: "Informe um horário válido." }, 400);
  if (!title) return json({ error: "Informe o nome da aula." }, 400);
  await ensureDatabase();
  const id = crypto.randomUUID();
  await runtime.DB.prepare("INSERT INTO schedule_entries (id, weekday, start_time, title, details) VALUES (?, ?, ?, ?, ?)")
    .bind(id, weekday, startTime, title, details).run();
  return json({ entry: { id, weekday, start_time: startTime, title, details } }, 201);
}
