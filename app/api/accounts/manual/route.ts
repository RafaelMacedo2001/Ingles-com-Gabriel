import { sendAccountInvitation } from "../../../lib/invitations";
import { ensureDatabase, hashPassword, json, normalizePhone, oneYearFromNow, requireRole, runtime } from "../../../lib/server";

type ManualAccountPayload = {
  role?: "student" | "admin";
  type?: "student" | "admin" | "aluno" | "gestor";
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  expiresAt?: string;
  sendInvite?: boolean;
};

function resolveRole(payload: ManualAccountPayload) {
  const value = payload.role || payload.type;
  if (value === "student" || value === "aluno") return "student";
  if (value === "admin" || value === "gestor") return "admin";
  return null;
}

async function canUseManualEndpoint(request: Request) {
  if (await requireRole(request, "admin")) return true;
  const configuredSecret = runtime.MANUAL_ACCOUNT_SECRET;
  if (!configuredSecret) return false;
  const providedSecret = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return providedSecret === configuredSecret;
}

export async function POST(request: Request) {
  if (!(await canUseManualEndpoint(request))) return json({ error: "Não autorizado." }, 401);

  const payload = await request.json().catch(() => ({})) as ManualAccountPayload;
  const role = resolveRole(payload);
  const name = String(payload.name || payload.fullName || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const phone = normalizePhone(String(payload.phone || ""));
  const password = String(payload.password || "");
  const sendInvite = payload.sendInvite !== false;

  if (!role) return json({ error: "Informe role como 'student'/'aluno' ou 'admin'/'gestor'." }, 400);
  if (!name || !email.includes("@") || !phone) return json({ error: "Informe nome completo, e-mail e telefone válido." }, 400);

  await ensureDatabase();

  if (role === "admin") {
    const id = crypto.randomUUID();
    const passwordHash = password ? await hashPassword(password) : null;
    try {
      await runtime.DB.prepare("INSERT INTO admins (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)")
        .bind(id, name, email, phone, passwordHash).run();
    } catch {
      return json({ error: "Já existe um gestor com este e-mail." }, 409);
    }

    const invitation = sendInvite && !passwordHash
      ? await sendAccountInvitation(request, { role, name, email })
      : { sent: false, reason: passwordHash ? "Conta criada com senha definida." : "Envio de convite desativado para esta requisição." };

    return json({ id, role, name, email, phone, activated: Boolean(passwordHash), invitationSent: invitation.sent, invitationMessage: invitation.reason }, 201);
  }

  const expiresAt = payload.expiresAt || oneYearFromNow();
  const id = crypto.randomUUID();
  const passwordHash = password ? await hashPassword(password) : null;
  try {
    await runtime.DB.prepare("INSERT INTO students (id, name, email, phone, password_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, name, email, phone, passwordHash, expiresAt).run();
  } catch {
    return json({ error: "Já existe um aluno com este e-mail." }, 409);
  }

  const invitation = sendInvite && !passwordHash
    ? await sendAccountInvitation(request, { role, name, email, expiresAt })
    : { sent: false, reason: passwordHash ? "Conta criada com senha definida." : "Envio de convite desativado para esta requisição." };

  return json({ id, role, name, email, phone, expiresAt, activated: Boolean(passwordHash), invitationSent: invitation.sent, invitationMessage: invitation.reason }, 201);
}
