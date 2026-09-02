import { sendStudentInvitation } from "../../../../lib/invitations";
import { ensureDatabase, json, requireRole, runtime } from "../../../../lib/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  const { id } = await context.params;
  await ensureDatabase();
  const student = await runtime.DB.prepare("SELECT name, email, expires_at FROM students WHERE id = ? LIMIT 1")
    .bind(id).first<{ name: string; email: string; expires_at: string }>();
  if (!student) return json({ error: "Aluno não encontrado." }, 404);
  const invitation = await sendStudentInvitation(request, { name: student.name, email: student.email, expiresAt: student.expires_at });
  return json({ sent: invitation.sent, message: invitation.sent ? `Convite enviado para ${student.email}` : invitation.reason }, invitation.sent ? 200 : 503);
}
