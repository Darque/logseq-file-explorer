import type { TreeNode } from "./types";
import { readdir, stat } from "../fsOps";
import { state } from "../state";

export interface FsTreeResult {
  tree: TreeNode[];
  rootFolders: string[];
  error?: string;
  graphPath?: string;
}

export async function buildFsTree(): Promise<FsTreeResult> {
  const graph = await logseq.App.getCurrentGraph();
  const root: string | undefined = (graph as any)?.path;
  if (!root) {
    return {
      tree: [],
      rootFolders: [],
      error: "Date view requires a file-based graph.",
    };
  }

  const raw = await readdir(root);
  if (!raw) {
    return {
      tree: [],
      rootFolders: [],
      error: "Filesystem API unavailable in this Logseq build.",
      graphPath: root,
    };
  }

  const paths = normalizeReaddir(raw);
  if (!paths.length) {
    return { tree: [], rootFolders: [], error: "No files found.", graphPath: root };
  }

  const relativePaths = paths.map((abs) => toRelative(abs, root)).filter(Boolean);
  const rootFolders = new Set(relativePaths.filter((p) => p.includes("/")).map((p) => p.split("/")[0]));
  const rootEntries = relativePaths.filter((p) => !p.includes("/"));
  await Promise.all(rootEntries.map(async (entry) => {
    const info = await stat(`${root.replace(/\/+$/, "")}/${entry}`);
    if ((typeof info?.isDirectory === "function" && info.isDirectory()) || info?.isDirectory === true ||
      info?.type === "directory" || (typeof info?.mode === "number" && (info.mode & 0o170000) === 0o040000)) {
      rootFolders.add(entry);
    }
  }));
  const folders = [...rootFolders].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const rel = relativePaths.filter((p) => {
    const slash = p.indexOf("/");
    return slash > 0 && state.isRootFolderSelected(root, p.slice(0, slash)) && !p.endsWith("/.DS_Store");
  });

  const tree = buildTree(rel);
  return { tree, rootFolders: folders, graphPath: root };
}

function normalizeReaddir(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x : x?.path ?? x?.filePath))
      .filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  return [];
}

function toRelative(abs: string, root: string): string {
  const rootNorm = root.replace(/\/+$/, "");
  if (abs.startsWith(rootNorm + "/")) return abs.slice(rootNorm.length + 1);
  if (abs === rootNorm) return "";
  return abs;
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isLeaf: false, children: [] };
  for (const rel of paths) {
    const parts = rel.split("/");
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partPath = parts.slice(0, i + 1).join("/");
      const isLast = i === parts.length - 1;
      cursor.children = cursor.children || [];
      let child = cursor.children.find((c) => c.name === part);
      if (!child) {
        const pn = isLast ? fileToPage(partPath) : undefined;
        const canonical = isLast && !!pn &&
          (partPath.startsWith("pages/") || partPath.startsWith("journals/"));
        child = {
          name: part,
          path: partPath,
          isLeaf: isLast,
          pageName: pn,
          canonicalPage: canonical,
          children: isLast ? undefined : [],
        };
        cursor.children.push(child);
      }
      if (!isLast) cursor = child;
    }
  }
  sort(root);
  return root.children || [];
}

function fileToPage(rel: string): string | undefined {
  if (!rel.endsWith(".md")) return undefined;
  const base = rel.replace(/\.md$/, "");
  if (base.startsWith("pages/")) return base.slice(6).replace(/___/g, "/");
  if (base.startsWith("journals/")) {
    const name = base.slice(9);
    const m = name.match(/^(\d{4})[_-](\d{2})[_-](\d{2})$/);
    if (m) {
      const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return formatDate(date, state.dateFormat);
    }
    return name;
  }
  const idx = base.lastIndexOf("/");
  return (idx >= 0 ? base.slice(idx + 1) : base).replace(/___/g, "/");
}

function sort(node: TreeNode) {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) sort(c);
}

export function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function stripExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function ordinal(n: number): string {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatDate(date: Date, fmt: string): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const dow = date.getDay();
  const tokens: Array<[RegExp, string]> = [
    [/EEEE/g, DAYS[dow]],
    [/EEE/g, DAYS_SHORT[dow]],
    [/MMMM/g, MONTHS[m]],
    [/MMM/g, MONTHS_SHORT[m]],
    [/MM/g, String(m + 1).padStart(2, "0")],
    [/yyyy/g, String(y)],
    [/yy/g, String(y).slice(-2)],
    [/do/g, ordinal(d)],
    [/dd/g, String(d).padStart(2, "0")],
    [/\bd\b/g, String(d)],
  ];
  let out = fmt;
  for (const [re, val] of tokens) out = out.replace(re, val);
  return out;
}
