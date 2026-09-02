import { ensureDatabase, json, requireRole, runtime } from "../../../lib/server";

export async function POST(request: Request) {
  const session = await requireRole(request, "student");
  if (!session) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  await runtime.DB.prepare(`INSERT OR IGNORE INTO communication_reads (student_id, communication_id)
    SELECT ?, communications.id FROM communications`).bind(session.id).run();
  return json({ ok: true });
}
