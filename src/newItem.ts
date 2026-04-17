import { getLastFsError, joinPath, mkdir, writeFile } from "./fsOps";

function toast(msg: string, kind: "success" | "warning" = "success") {
  try {
    (logseq as any).UI?.showMsg?.(msg, kind);
  } catch {
    /* noop */
  }
}

async function getGraphPath(): Promise<string | null> {
  const g: any = await (logseq as any).App.getCurrentGraph();
  return g?.path ?? null;
}

export async function createNewFile(parentRel = ""): Promise<void> {
  const graphPath = await getGraphPath();
  if (!graphPath) {
    toast("No graph path", "warning");
    return;
  }
  const name = prompt(
    "New file name (include extension, e.g. Note.md):",
    "Untitled.md",
  );
  if (!name) return;
  const abs = joinPath(graphPath, parentRel, name);
  const ok = await writeFile(graphPath, abs, "");
  if (ok) toast(`Created ${name}`);
  else toast(`Create failed: ${getLastFsError() || "unknown error"}`, "warning");
}

export async function createNewFolder(parentRel = ""): Promise<void> {
  const graphPath = await getGraphPath();
  if (!graphPath) {
    toast("No graph path", "warning");
    return;
  }
  const name = prompt("New folder name:", "New Folder");
  if (!name) return;
  const abs = joinPath(graphPath, parentRel, name);
  const ok = await mkdir(abs, true);
  if (ok) toast(`Created ${name}/`);
  else toast(`Create failed: ${getLastFsError() || "unknown error"}`, "warning");
}
