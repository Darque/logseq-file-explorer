import type { TreeNode } from "./types";

export async function buildPagesTree(): Promise<TreeNode[]> {
  const pages = (await logseq.Editor.getAllPages()) || [];
  const root: TreeNode = { name: "", path: "", isLeaf: false, children: [] };

  const journalRoot: TreeNode = {
    name: "journals",
    path: "__journals",
    isLeaf: false,
    children: [],
  };

  for (const p of pages as any[]) {
    const name: string = p.originalName ?? p.name ?? "";
    if (!name) continue;
    if (name.startsWith("$")) continue;

    if (p["journal?"] || p.journal) {
      journalRoot.children!.push({
        name,
        path: `__journals/${name}`,
        isLeaf: true,
        pageName: name,
      });
      continue;
    }

    const parts = name.split("/");
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partPath = parts.slice(0, i + 1).join("/");
      const isLast = i === parts.length - 1;
      cursor.children = cursor.children || [];
      let child = cursor.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: partPath,
          isLeaf: isLast,
          pageName: isLast ? name : undefined,
          children: isLast ? undefined : [],
        };
        cursor.children.push(child);
      } else if (isLast) {
        child.isLeaf = true;
        child.pageName = name;
      }
      if (!isLast) cursor = child;
    }
  }

  sort(root);
  sort(journalRoot);

  const out = root.children || [];
  if (journalRoot.children && journalRoot.children.length) {
    journalRoot.children.sort((a, b) => b.name.localeCompare(a.name));
    out.unshift(journalRoot);
  }
  return out;
}

function sort(node: TreeNode) {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) sort(c);
}
