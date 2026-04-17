import { basename, dirname, getLastFsError, joinPath, renamePath } from "./fsOps";

const MIME = "application/x-fe-path";

let onReload: (() => void) | null = null;

export function initDnd(reload: () => void) {
  onReload = reload;
  const host = (window as any).top?.document ?? document;

  host.addEventListener("dragstart", onDragStart, true);
  host.addEventListener("dragover", onDragOver, true);
  host.addEventListener("dragleave", onDragLeave, true);
  host.addEventListener("drop", onDrop, true);
  host.addEventListener("dragend", onDragEnd, true);
}

function onDragStart(e: DragEvent) {
  const row = (e.target as HTMLElement)?.closest?.(
    "#fe-panel .fe-row",
  ) as HTMLElement | null;
  if (!row) return;
  const src = row.dataset.source;
  if (src !== "fs") {
    // Pages are name-indexed, not path-indexed — block drag-to-move for pages.
    e.preventDefault();
    return;
  }
  const path = row.dataset.path || "";
  e.dataTransfer?.setData(MIME, path);
  e.dataTransfer?.setData("text/plain", path);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  row.classList.add("is-dragging");
}

function onDragOver(e: DragEvent) {
  const row = (e.target as HTMLElement)?.closest?.(
    "#fe-panel .fe-row",
  ) as HTMLElement | null;
  const list = (e.target as HTMLElement)?.closest?.(
    "#fe-panel .monaco-list",
  ) as HTMLElement | null;

  const types = Array.from(e.dataTransfer?.types || []);
  if (!types.includes(MIME)) return;

  const srcPath = dragSourcePath();
  if (!srcPath) return;

  const dropTarget = resolveDropTarget(row, list, srcPath);
  if (!dropTarget) {
    clearDropHighlights();
    return;
  }

  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  clearDropHighlights();
  dropTarget.el.classList.add("drop-target");
}

function onDragLeave(e: DragEvent) {
  const row = (e.target as HTMLElement)?.closest?.(
    "#fe-panel .fe-row",
  ) as HTMLElement | null;
  if (row) row.classList.remove("drop-target");
}

function onDragEnd(_e: DragEvent) {
  const host = (window as any).top?.document ?? document;
  host.querySelectorAll("#fe-panel .is-dragging").forEach((el: Element) =>
    el.classList.remove("is-dragging"),
  );
  clearDropHighlights();
}

async function onDrop(e: DragEvent) {
  const srcPath = e.dataTransfer?.getData(MIME);
  if (!srcPath) return;

  const row = (e.target as HTMLElement)?.closest?.(
    "#fe-panel .fe-row",
  ) as HTMLElement | null;
  const list = (e.target as HTMLElement)?.closest?.(
    "#fe-panel .monaco-list",
  ) as HTMLElement | null;

  const dropTarget = resolveDropTarget(row, list, srcPath);
  if (!dropTarget) return;

  e.preventDefault();
  clearDropHighlights();

  const panel = (e.target as HTMLElement).closest("#fe-panel") as HTMLElement | null;
  const graphPath = panel?.dataset.graphPath || "";
  if (!graphPath) {
    toast("No graph path; cannot move", "warning");
    return;
  }

  const absFrom = joinPath(graphPath, srcPath);
  const destDirRel = dropTarget.relPath;
  const absTo = joinPath(graphPath, destDirRel, basename(srcPath));

  if (absFrom === absTo) return;

  const ok = await renamePath(absFrom, absTo);
  if (ok) toast("Moved");
  else toast(`Move failed: ${getLastFsError() || "unknown error"}`, "warning");
  onReload?.();
}

interface DropTarget {
  el: HTMLElement;
  relPath: string; // folder path, relative to graph root, where the src will land
}

function resolveDropTarget(
  row: HTMLElement | null,
  list: HTMLElement | null,
  srcPath: string,
): DropTarget | null {
  // Dropping on a folder row → drop INTO that folder.
  if (row && row.dataset.kind === "folder") {
    const relPath = row.dataset.path || "";
    if (relPath === srcPath) return null; // drop on self
    if (relPath.startsWith(srcPath + "/")) return null; // drop into own descendant
    if (dirname(srcPath) === relPath) return null; // already there
    return { el: row, relPath };
  }

  // Dropping on a file row → treat as dropping into its parent folder (no-op if same).
  if (row && (row.dataset.kind === "file" || row.dataset.kind === "page")) {
    const rel = row.dataset.path || "";
    const parent = dirname(rel);
    if (dirname(srcPath) === parent) return null;
    return { el: row, relPath: parent };
  }

  // Dropping on the empty list area → drop at the graph root.
  if (list) {
    if (dirname(srcPath) === "") return null;
    return { el: list, relPath: "" };
  }

  return null;
}

function dragSourcePath(): string {
  const host = (window as any).top?.document ?? document;
  const el = host.querySelector(
    "#fe-panel .fe-row.is-dragging",
  ) as HTMLElement | null;
  return el?.dataset.path || "";
}

function clearDropHighlights() {
  const host = (window as any).top?.document ?? document;
  host.querySelectorAll("#fe-panel .drop-target").forEach((el: Element) =>
    el.classList.remove("drop-target"),
  );
}

function toast(msg: string, kind: "success" | "warning" = "success") {
  try {
    (logseq as any).UI?.showMsg?.(msg, kind);
  } catch {
    /* noop */
  }
}
