import { ensureDatabase, json, requireRole, runtime } from "../../../lib/server";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { id } = await context.params;
  await ensureDatabase();
  await runtime.DB.prepare("DELETE FROM communications WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
