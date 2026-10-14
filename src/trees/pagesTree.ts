import type { TreeNode } from "./types";
import { buildFsTree, stripExt } from "./fsTree";
import { parseModifiedTime } from "../modifiedTime";

/** Pages are organised by their real graph folders, then by filename namespaces. */
export async function buildPagesTree(): Promise<TreeNode[]> {
  const files = await buildFsTree();
  if (files.graphPath && !files.error) return pagesFromFiles(files.tree);

  // DB graphs and Logseq builds without filesystem IPC still have a Pages view.
  return pagesFromApi((await logseq.Editor.getAllPages()) || []);
}

export function pagesFromFiles(files: TreeNode[]): TreeNode[] {
  const convert = (nodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      if (!node.isLeaf) {
        const children = convert(node.children || []);
        if (children.length) result.push({ ...node, children });
        continue;
      }
      if (!/\.md$/i.test(node.name)) continue;

      const parts = stripExt(node.name).split("___").filter(Boolean);
      if (!parts.length) continue;
      const pageName = node.canonicalPage ? node.pageName : undefined;
      insertPage(result, parts, pageName, node.path);
    }
    sort(result);
    return result;
  };
  return convert(files);
}

function pagesFromApi(pages: any[]): TreeNode[] {
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
      insertPage(root, name.split("/").filter(Boolean), name, `__page/${name}`,
        parseModifiedTime(page));
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
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) if (node.children) sort(node.children);
}
