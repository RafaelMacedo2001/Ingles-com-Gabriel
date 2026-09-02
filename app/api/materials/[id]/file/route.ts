import { ensureDatabase, json, readSession, runtime } from "../../../../lib/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await readSession(request))) return json({ error: "Não autorizado." }, 401);
  await ensureDatabase();
  if (!runtime.MATERIALS) return json({ error: "Armazenamento de materiais não configurado." }, 503);
  const { id } = await context.params;
  const material = await runtime.DB.prepare("SELECT file_name, object_key, content_type FROM lesson_materials WHERE id = ? LIMIT 1")
    .bind(id).first<{ file_name: string; object_key: string; content_type: string }>();
  if (!material) return json({ error: "Material não encontrado." }, 404);
  const object = await runtime.MATERIALS.get(material.object_key);
  if (!object) return json({ error: "Arquivo do material não encontrado." }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", material.content_type || headers.get("content-type") || "application/octet-stream");
  headers.set("content-length", String(object.size));
  headers.set("cache-control", "private, max-age=300");
  const disposition = /^(application\/pdf|image\/)/.test(material.content_type) ? "inline" : "attachment";
  const safeName = material.file_name.replace(/[\r\n"\\]/g, "_");
  headers.set("content-disposition", `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(material.file_name)}`);
  return new Response(object.body, { headers });
}
