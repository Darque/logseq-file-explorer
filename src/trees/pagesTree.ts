import type { TreeNode } from "./types";
import { buildFsTree, stripExt, type FsTreeResult } from "./fsTree";
import { parseModifiedTime } from "../modifiedTime";
import { namespaceParts } from "./namespaceParts";

/** Pages are organised by their real graph folders, then by filename namespaces. */
export async function buildPagesTree(namespaceDepth = 99): Promise<TreeNode[]> {
  const files = await buildFsTree();
  if (files.graphPath && !files.error) return pagesFromFiles(files.tree, namespaceDepth);

  // DB graphs and Logseq builds without filesystem IPC still have a Name view.
  return pagesFromApi((await logseq.Editor.getAllPages()) || [], namespaceDepth);
}

export async function getMaxNamespaceDepth(files: FsTreeResult): Promise<number> {
  if (files.graphPath && !files.error) {
    let max = 0;
    const visit = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (!node.isLeaf) visit(node.children || []);
        else if (/\.md$/i.test(node.name)) max = Math.max(max, stripExt(node.name).split("___").filter(Boolean).length - 1);
      }
    };
    visit(files.tree);
    return max;
  }
  const pages = (await logseq.Editor.getAllPages()) || [];
  return pages.reduce((max: number, page: any) => {
    if (page["journal?"] || page.journal) return max;
    const name: string = page.originalName ?? page.name ?? "";
    return Math.max(max, name.split("/").filter(Boolean).length - 1);
  }, 0);
}

export function pagesFromFiles(files: TreeNode[], namespaceDepth = 99): TreeNode[] {
  const convert = (nodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      if (!node.isLeaf) {
        const children = convert(node.children || []);
        if (children.length) result.push({ ...node, children });
        continue;
      }
      if (!/\.md$/i.test(node.name)) continue;

      const fullParts = stripExt(node.name).split("___").filter(Boolean);
      if (!fullParts.length) continue;
      const pageName = node.canonicalPage ? node.pageName : undefined;
      const parts = namespaceParts(fullParts, namespaceDepth);
      insertPage(result, parts, pageName, node.path, node.modifiedAt);
    }
    sort(result);
    return result;
  };
  return convert(files);
}

function pagesFromApi(pages: any[], namespaceDepth = 99): TreeNode[] {
  const root: TreeNode[] = [];
  const journals: TreeNode = {
    name: "journals", path: "__journals", isLeaf: false,
    virtual: true, children: [],
  };
  for (const page of pages) {
    const name: string = page.originalName ?? page.name ?? "";
    if (!name || name.startsWith("$")) continue;
    if (page["journal?"] || page.journal) {
      journals.children!.push({ name, path: `__journals/${name}`, isLeaf: true, pageName: name,
        modifiedAt: parseModifiedTime(page) });
    } else {
      const parts = name.split("/").filter(Boolean);
      const visibleParts = namespaceParts(parts, namespaceDepth);
      insertPage(root, visibleParts, name, `__page/${name}`, parseModifiedTime(page));
    }
  }
  sort(root);
  journals.children!.sort((a, b) => b.name.localeCompare(a.name));
  if (journals.children!.length) root.unshift(journals);
  return root;
}

function insertPage(nodes: TreeNode[], parts: string[], pageName: string | undefined,
  filePath: string, modifiedAt?: number) {
  let siblings = nodes;
  for (let i = 0; i < parts.length - 1; i++) {
    const prefix = parts.slice(0, i + 1).join("/");
    const path = `__namespace/${filePath.slice(0, filePath.lastIndexOf("/") + 1)}${prefix}`;
    let folder = siblings.find((n) => n.virtual && n.path === path);
    if (!folder) {
      folder = { name: parts[i], path, isLeaf: false, virtual: true, children: [] };
      siblings.push(folder);
    }
    siblings = folder.children!;
  }
  siblings.push({ name: parts[parts.length - 1], path: filePath, isLeaf: true, pageName,
    modifiedAt });
}

function sort(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    const priority = (n: TreeNode) => n.name.toLowerCase() === "contents" ? 0 : n.name.startsWith("_") ? 1 : 2;
    const p = priority(a) - priority(b);
    if (p) return p;
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) if (node.children) sort(node.children);
}
