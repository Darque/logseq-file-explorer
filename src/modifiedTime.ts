import { stat } from "./fsOps";
import type { TreeNode } from "./trees/types";

const cache = new Map<string, Promise<number | undefined>>();

export function clearModifiedTimeCache(): void {
  cache.clear();
}

/** Fetch times only for rows that are visible in the expanded tree. */
export async function addModifiedTimes(
  nodes: TreeNode[],
  graphPath: string | undefined,
  isOpen: (path: string) => boolean,
): Promise<void> {
  const visible: TreeNode[] = [];
  const visit = (items: TreeNode[]) => {
    for (const node of items) {
      if (node.isLeaf) visible.push(node);
      else if (isOpen(node.path) && node.children) visit(node.children);
    }
  };
  visit(nodes);

  if (!graphPath) return;
  await Promise.all(visible.map(async (node) => {
    if (node.modifiedAt !== undefined || node.path.startsWith("__")) return;
    const absPath = `${graphPath.replace(/\/+$/, "")}/${node.path}`;
    let pending = cache.get(absPath);
    if (!pending) {
      pending = stat(absPath).then(parseModifiedTime);
      cache.set(absPath, pending);
    }
    node.modifiedAt = await pending;
  }));
}

export function parseModifiedTime(value: any): number | undefined {
  const raw = value?.mtimeMs ?? value?.mtime ?? value?.modifiedAt;
  if (raw == null) return undefined;
  const time = raw instanceof Date ? raw.getTime()
    : typeof raw === "number" ? raw
    : new Date(raw).getTime();
  return Number.isFinite(time) && time > 0 ? time : undefined;
}

/** Local system time, with a compact day/month/year and 24-hour clock. */
export function formatModifiedTime(timestamp: number): string {
  const date = new Date(timestamp);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${two(date.getFullYear() % 100)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
