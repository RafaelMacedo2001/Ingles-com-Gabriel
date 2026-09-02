import { ensureDatabase, json, readSession, requireRole, runtime } from "../../lib/server";

const MAX_MATERIAL_SIZE = 50 * 1024 * 1024;
const allowedExtension = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|png|jpe?g)$/i;

export async function GET(request: Request) {
  if (!(await readSession(request))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  const result = await runtime.DB.prepare(`SELECT id, lesson_id, lesson_title, title, file_name, content_type, size, created_at, updated_at
    FROM lesson_materials ORDER BY updated_at DESC`).all();
  return json({ materials: result.results.map((item) => ({ ...item, url: `/api/materials/${item.id}/file` })) });
}

export async function POST(request: Request) {
  if (!(await requireRole(request, "admin"))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  if (!runtime.MATERIALS) return json({ error: "Armazenamento de materiais não configurado." }, 503);
  const form = await request.formData();
  const lessonId = String(form.get("lessonId") || "").trim();
  const lessonTitle = String(form.get("lessonTitle") || "").trim();
  const title = String(form.get("title") || "").trim();
  const file = form.get("file");
  if (!lessonId || !lessonTitle || !title || !(file instanceof File) || !file.size) return json({ error: "Informe a aula, o título e o arquivo do material." }, 400);
  if (!allowedExtension.test(file.name)) return json({ error: "Formato não permitido. Use PDF, Office, ZIP, PNG ou JPG." }, 400);
  if (file.size > MAX_MATERIAL_SIZE) return json({ error: "O material deve ter no máximo 50 MB." }, 400);

  const existing = await runtime.DB.prepare("SELECT id, object_key FROM lesson_materials WHERE lesson_id = ? LIMIT 1").bind(lessonId).first<{ id: string; object_key: string }>();
  const id = existing?.id || crypto.randomUUID();
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-160) || "material";
  const objectKey = `lessons/${lessonId}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || "application/octet-stream";
  await runtime.MATERIALS.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType } });
  try {
    await runtime.DB.prepare(`INSERT INTO lesson_materials (id, lesson_id, lesson_title, title, file_name, object_key, content_type, size, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(lesson_id) DO UPDATE SET lesson_title = excluded.lesson_title, title = excluded.title, file_name = excluded.file_name,
      object_key = excluded.object_key, content_type = excluded.content_type, size = excluded.size, updated_at = CURRENT_TIMESTAMP`)
      .bind(id, lessonId, lessonTitle, title, file.name.slice(0, 220), objectKey, contentType, file.size).run();
  } catch (error) {
    await runtime.MATERIALS.delete(objectKey);
    throw error;
  }
  if (existing?.object_key && existing.object_key !== objectKey) await runtime.MATERIALS.delete(existing.object_key);
  return json({ material: { id, lessonId, lessonTitle, title, fileName: file.name, contentType, size: file.size, url: `/api/materials/${id}/file` } }, 201);
}
