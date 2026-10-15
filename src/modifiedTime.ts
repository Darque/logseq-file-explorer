import { stat } from "./fsOps";
import type { TreeNode } from "./trees/types";
import { namespaceParts } from "./trees/namespaceParts";

const cache = new Map<string, Promise<number | undefined>>();

export function clearModifiedTimeCache(): void {
  cache.clear();
}

/** Fetch times only for rows that are visible in the expanded tree. */
export async function addModifiedTimes(
  nodes: TreeNode[],
  graphPath: string | undefined,
  isOpen: (path: string) => boolean,
  includeAll = false,
): Promise<void> {
  const visible: TreeNode[] = [];
  const visit = (items: TreeNode[]) => {
    for (const node of items) {
      if (node.isLeaf) visible.push(node);
      else if ((includeAll || isOpen(node.path)) && node.children) visit(node.children);
    }
  };
  visit(nodes);

  if (!graphPath) return;
  let cursor = 0;
  const worker = async () => {
    while (cursor < visible.length) {
      const node = visible[cursor++];
      if (node.modifiedAt !== undefined || node.path.startsWith("__")) continue;
      const absPath = `${graphPath.replace(/\/+$/, "")}/${node.path}`;
      let pending = cache.get(absPath);
      if (!pending) {
        pending = stat(absPath).then(parseModifiedTime);
        cache.set(absPath, pending);
      }
      node.modifiedAt = await pending;
    }
  };
  await Promise.all(Array.from({ length: Math.min(12, visible.length) }, worker));
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


/** Group recent edits by local hour, then day, ignoring physical folders. */
export function dateTree(nodes: TreeNode[], namespaceDepth = 1, recentWeeks = 1, recentHours = 24): TreeNode[] {
  const result: TreeNode[] = [];
  const hourCutoff = Date.now() - Math.max(0, Math.floor(recentHours)) * 60 * 60 * 1000;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 7 * Math.max(0, Math.floor(recentWeeks)));
  const visit = (items: TreeNode[]) => {
    for (const node of items) {
      if (!node.isLeaf) {
        visit(node.children || []);
        continue;
      }
      if (node.modifiedAt === undefined) continue;
      const d = new Date(node.modifiedAt);
      const hour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const older = node.modifiedAt < cutoff.getTime();
      const byHour = !older && node.modifiedAt >= hourCutoff;
      const dateLabel = `${two(d.getDate())}/${two(d.getMonth() + 1)}/${two(d.getFullYear() % 100)}`;
      const group = older ? "Older files" : byHour ? `${dateLabel} ${two(d.getHours())}:00` : dateLabel;
      const isMarkdown = /\.md$/i.test(node.name);
      const stem = isMarkdown ? node.name.replace(/\.md$/i, "") : node.name;
      const fullParts = isMarkdown ? stem.split("___").filter(Boolean) : [stem];
      const visibleParts = namespaceParts(fullParts, isMarkdown ? namespaceDepth : 0);
      const namespaceFolders = visibleParts.slice(0, -1);
      const label = visibleParts[visibleParts.length - 1];
      const leaf: TreeNode = { ...node, name: label, isLeaf: true };
      insertPath(result, [group, ...namespaceFolders], leaf, older ? -1 : byHour ? hour : day);
    }
  };
  visit(nodes);
  sortDateTree(result);
  return result;
}

function insertPath(root: TreeNode[], parts: string[], leaf: TreeNode, sortTime: number) {
  let list = root;
  let path = "__date";
  for (const name of parts) {
    path += `/${name}`;
    let folder = list.find((n) => !n.isLeaf && n.name === name && n.path === path);
    if (!folder) { folder = { name, path, isLeaf: false, virtual: true, children: [], sortTime }; list.push(folder); }
    list = folder.children!;
  }
  list.push(leaf);
}

function sortDateTree(nodes: TreeNode[], isRoot = true) {
  nodes.sort((a, b) => {
    if (isRoot) return (b.sortTime || 0) - (a.sortTime || 0);
    const priority = (n: TreeNode) => n.name.toLowerCase() === "contents" ? 0 : n.name.startsWith("_") ? 1 : 2;
    const p = priority(a) - priority(b);
    if (p) return p;
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    if (a.isLeaf) return (b.modifiedAt || 0) - (a.modifiedAt || 0) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
  for (const node of nodes) if (node.children) sortDateTree(node.children, false);
}

function two(n: number) { return String(n).padStart(2, "0"); }
