import { ensureDatabase, json, listDriveLessons, readSession, runtime } from "../../lib/server";

const demoLessons = [
  { id: "demo-48", name: "Small talk: como manter uma conversa.mp4", createdTime: "2026-08-31T12:00:00Z", size: "545259520", videoMediaMetadata: { durationMillis: "3132000" } },
  { id: "demo-47", name: "Present Perfect sem complicação.mp4", createdTime: "2026-08-30T12:00:00Z", size: "482344960", videoMediaMetadata: { durationMillis: "2795000" } },
  { id: "demo-46", name: "Inglês para viagens: no aeroporto.mp4", createdTime: "2026-08-29T12:00:00Z", size: "608174080", videoMediaMetadata: { durationMillis: "3498000" } },
];

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const files = await listDriveLessons();
  const source = files || demoLessons;
  const metadata = await runtime.DB.prepare("SELECT file_id, title, level FROM lesson_metadata").all<{ file_id: string; title: string; level: string }>();
  const materials = await runtime.DB.prepare("SELECT id, lesson_id, title, file_name, content_type, size FROM lesson_materials").all<{ id: string; lesson_id: string; title: string; file_name: string; content_type: string; size: number }>();
  const byId = new Map(metadata.results.map((item) => [item.file_id, item]));
  const materialsByLesson = new Map(materials.results.map((item) => [item.lesson_id, { id: item.id, title: item.title, fileName: item.file_name, contentType: item.content_type, size: item.size, url: `/api/materials/${item.id}/file` }]));
  const lessons = source.map((file) => {
    const saved = byId.get(file.id);
    return { ...file, title: saved?.title || file.name.replace(/\.[^.]+$/, ""), level: saved?.level || "Todos os níveis", material: materialsByLesson.get(file.id) || null };
  });
  return json({ lessons, configured: files !== null, canEdit: session.role === "admin" });
}
