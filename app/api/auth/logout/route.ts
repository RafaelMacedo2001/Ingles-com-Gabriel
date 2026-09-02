import { clearSessionCookie, json } from "../../../lib/server";

export async function POST() {
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}
