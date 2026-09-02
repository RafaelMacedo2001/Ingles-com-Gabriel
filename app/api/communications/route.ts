import { ensureDatabase, json, readSession, requireRole, runtime } from "../../lib/server";

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const result = session.role === "student"
    ? await runtime.DB.prepare(`SELECT communications.id, communications.title, communications.body, communications.created_at,
        CASE WHEN communication_reads.communication_id IS NULL THEN 1 ELSE 0 END AS unread
      FROM communications
      LEFT JOIN communication_reads ON communication_reads.communication_id = communications.id AND communication_reads.student_id = ?
      ORDER BY communications.created_at DESC`).bind(session.id).all()
    : await runtime.DB.prepare("SELECT id, title, body, created_at, 0 AS unread FROM communications ORDER BY created_at DESC").all();
  return json({ communications: result.results });
}

export async function POST(request: Request) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { title = "", body = "" } = await request.json() as { title?: string; body?: string };
  if (!title.trim() || !body.trim()) return json({ error: "Informe título e mensagem." }, 400);
  await ensureDatabase();
  const id = crypto.randomUUID();
  await runtime.DB.prepare("INSERT INTO communications (id, title, body) VALUES (?, ?, ?)").bind(id, title.trim(), body.trim()).run();
  return json({ id, title: title.trim(), body: body.trim(), created_at: new Date().toISOString() }, 201);
}
