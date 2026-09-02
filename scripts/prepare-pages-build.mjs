import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const serverDir = join(projectRoot, "dist", "server");
const clientDir = join(projectRoot, "dist", "client");

await mkdir(clientDir, { recursive: true });

for (const entry of await readdir(serverDir)) {
  if (entry === "wrangler.json") continue;
  await cp(join(serverDir, entry), join(clientDir, entry), { recursive: true, force: true });
}

await writeFile(
  join(clientDir, "_worker.js"),
  `import app from "./index.js";

const staticAssetPattern = /^(?:\\/_next\\/static\\/|\\/favicon\\.svg$|\\/file\\.svg$|\\/gabriel-course-icon\\.png$|\\/globe\\.svg$|\\/og(?:-ingles-com-gabriel)?\\.png$|\\/window\\.svg$|\\/apostila-do-zero-a-fluencia\\.pdf$|\\/capa-apostila-ingles-com-gabriel\\.jpeg$)/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (env.ASSETS && staticAssetPattern.test(url.pathname)) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return app.fetch(request, env, ctx);
  },
};
`,
);
