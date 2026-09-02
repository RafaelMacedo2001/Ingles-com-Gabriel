import { ensureDatabase, json, requireRole, runtime } from "../../../lib/server";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `+${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "invalid";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { id } = await context.params;
  const { expiresAt, phone } = await request.json() as { expiresAt?: string; phone?: string };
  if (!expiresAt) return json({ error: "Informe a nova validade." }, 400);
  const normalizedPhone = phone === undefined ? undefined : normalizePhone(phone);
  if (normalizedPhone === "invalid") return json({ error: "Informe um telefone válido." }, 400);
  await ensureDatabase();
  const current = await runtime.DB.prepare("SELECT expires_at FROM students WHERE id = ? LIMIT 1").bind(id).first<{ expires_at: string }>();
  if (!current) return json({ error: "Aluno não encontrado." }, 404);
  const isRenewal = new Date(expiresAt).getTime() > new Date(current.expires_at).getTime();
  await runtime.DB.prepare("UPDATE students SET expires_at = ?, phone = COALESCE(?, phone), renewal_count = renewal_count + ? WHERE id = ?").bind(expiresAt, normalizedPhone ?? null, isRenewal ? 1 : 0, id).run();
  return json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { id } = await context.params;
  await ensureDatabase();
  await runtime.DB.prepare("DELETE FROM students WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
