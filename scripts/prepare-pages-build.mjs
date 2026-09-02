import { cp, mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const serverDir = join(projectRoot, "dist", "server");
const clientDir = join(projectRoot, "dist", "client");

await mkdir(clientDir, { recursive: true });

for (const entry of await readdir(serverDir)) {
  if (entry === "wrangler.json") continue;
  await cp(join(serverDir, entry), join(clientDir, entry), { recursive: true, force: true });
}

await rename(join(clientDir, "index.js"), join(clientDir, "_worker.js"));
