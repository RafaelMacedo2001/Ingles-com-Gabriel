import { ensureDatabase, json, readSession, streamDriveLesson } from "../../../../lib/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await readSession(request))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const { id } = await context.params;
  const driveResponse = await streamDriveLesson(id, request.headers.get("range"));
  if (!driveResponse) return json({ error: "Google Drive ainda não configurado." }, 503);
  const headers = new Headers();
  ["content-type", "content-length", "content-range", "accept-ranges"].forEach((name) => {
    const value = driveResponse.headers.get(name);
    if (value) headers.set(name, value);
  });
  headers.set("cache-control", "private, no-store");
  return new Response(driveResponse.body, { status: driveResponse.status, headers });
}
