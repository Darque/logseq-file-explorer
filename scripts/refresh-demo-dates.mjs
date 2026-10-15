import { readdir, stat, utimes } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const graph = fileURLToPath(new URL("../fixtures/demo-graph/", import.meta.url));
const roots = ["clippings", "journals", "pages"];
const now = new Date();

async function refresh(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await refresh(file);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const metadata = await stat(file);
      await utimes(file, metadata.atime, now);
    }
  }
}

for (const root of roots) await refresh(path.join(graph, root));
process.stdout.write(`Refreshed Markdown dates in ${graph}\n`);
