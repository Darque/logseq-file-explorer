import {
  basename,
  copyFile,
  dirname,
  extname,
  getLastFsError,
  joinPath,
  readFileRaw,
  renamePath,
  revealInFinder,
  unlinkPath,
  writeFile,
} from "./fsOps";
import { createNewFile, createNewFolder } from "./newItem";

interface RowData {
  kind: "page" | "file" | "folder";
  source: "page" | "fs";
  path: string;
  page?: string;
  absPath?: string;
  canonical?: boolean;
}

let currentMenu: HTMLElement | null = null;
let onReload: (() => void) | null = null;

export function initContextMenu(reload: () => void) {
  onReload = reload;
  const host = (window as any).top?.document ?? document;

  host.addEventListener("contextmenu", handleContextMenu, true);
  host.addEventListener("click", handleDocClick, true);
  host.addEventListener("keydown", handleKey, true);
}

function handleContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const panel = target.closest?.("#fe-panel") as HTMLElement | null;
  if (!panel) return;

  const row = target.closest?.("#fe-panel .fe-row") as HTMLElement | null;

  let items: MenuItem[];
  if (row) {
    const data = extractRowData(row);
    if (!data) return;
    items = menuItemsFor(data);
  } else {
    items = emptyAreaMenuItems();
  }

  e.preventDefault();
  e.stopPropagation();

  closeMenu();
  const menu = buildMenuFromItems(items);
  const host = (window as any).top?.document ?? document;
  host.body.appendChild(menu);
  positionMenu(menu, e);
  currentMenu = menu;
}

function handleDocClick(e: MouseEvent) {
  if (!currentMenu) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest?.(".fe-ctx-menu")) return;
  closeMenu();
}

function handleKey(e: KeyboardEvent) {
  if (e.key === "Escape" && currentMenu) closeMenu();
}

function closeMenu() {
  const host = (window as any).top?.document ?? document;
  host.querySelectorAll(".fe-ctx-menu").forEach((el: Element) => el.remove());
  currentMenu = null;
}

function extractRowData(row: HTMLElement): RowData | null {
  const kind = row.dataset.kind as RowData["kind"] | undefined;
  const source = row.dataset.source as RowData["source"] | undefined;
  const path = row.dataset.path;
  if (!kind || !source || !path) return null;
  const page = row.dataset.page;
  const canonical = row.dataset.canonical === "1" || source === "page";

  const panel = row.closest("#fe-panel") as HTMLElement | null;
  const graphPath = panel?.dataset.graphPath || "";
  const absPath = graphPath ? joinPath(graphPath, path) : undefined;

  return { kind, source, path, page, absPath, canonical };
}

interface MenuItem {
  label: string;
  action?: () => Promise<void> | void;
  divider?: boolean;
  submenu?: MenuItem[];
  disabled?: boolean;
}

function buildMenuFromItems(items: MenuItem[]): HTMLElement {
  const host = (window as any).top?.document ?? document;
  const menu = host.createElement("div");
  menu.className = "fe-ctx-menu";
  menu.addEventListener("contextmenu", (e: Event) => e.preventDefault());
  for (const item of items) renderItem(menu, item);
  return menu;
}

function renderItem(parent: HTMLElement, item: MenuItem) {
  const host = (window as any).top?.document ?? document;
  if (item.divider) {
    const d = host.createElement("div");
    d.className = "fe-ctx-divider";
    parent.appendChild(d);
    return;
  }
  const row = host.createElement("div");
  row.className = "fe-ctx-item" + (item.disabled ? " is-disabled" : "");
  row.textContent = item.label;

  if (item.submenu) {
    row.classList.add("has-submenu");
    const arrow = host.createElement("span");
    arrow.className = "fe-ctx-arrow";
    arrow.textContent = "▸";
    row.appendChild(arrow);

    let subEl: HTMLElement | null = null;
    row.addEventListener("mouseenter", () => {
      if (subEl) return;
      subEl = host.createElement("div");
      subEl.className = "fe-ctx-menu fe-ctx-submenu";
      for (const s of item.submenu!) renderItem(subEl, s);
      const rect = row.getBoundingClientRect();
      const hostWin = (window as any).top ?? window;
      subEl.style.left = rect.right + hostWin.scrollX + "px";
      subEl.style.top = rect.top + hostWin.scrollY + "px";
      host.body.appendChild(subEl);
    });
    row.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (subEl && !subEl.matches(":hover")) {
          subEl.remove();
          subEl = null;
        }
      }, 120);
    });
  } else if (item.action && !item.disabled) {
    row.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeMenu();
      try {
        await item.action!();
      } catch (err) {
        console.error("[file-explorer] action failed:", err);
      }
    });
  }

  parent.appendChild(row);
}

function positionMenu(menu: HTMLElement, e: MouseEvent) {
  const hostWin = (window as any).top ?? window;
  const x = e.pageX;
  const y = e.pageY;
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  const place = () => {
    const rect = menu.getBoundingClientRect();
    const vw = hostWin.innerWidth;
    const vh = hostWin.innerHeight;
    if (rect.right > vw) {
      menu.style.left = Math.max(0, x - rect.width - 4) + "px";
    }
    if (rect.bottom > vh) {
      menu.style.top = Math.max(0, y - rect.height - 4) + "px";
    }
  };
  hostWin.requestAnimationFrame(place);
}

function emptyAreaMenuItems(): MenuItem[] {
  return [
    { label: "New file", action: async () => { await createNewFile(); onReload?.(); } },
    { label: "New folder", action: async () => { await createNewFolder(); onReload?.(); } },
  ];
}

function menuItemsFor(data: RowData): MenuItem[] {
  const isPage = data.kind === "page" || !!data.page;
  const isFile = data.kind === "file";
  const isFolder = data.kind === "folder";
  const abs = data.absPath || "";

  const items: MenuItem[] = [];

  if (isFolder) {
    items.push({
      label: "New file",
      action: async () => { await createNewFile(data.path); onReload?.(); },
    });
    items.push({
      label: "New folder",
      action: async () => { await createNewFolder(data.path); onReload?.(); },
    });
    items.push({ divider: true } as MenuItem);
  }

  if (isPage && data.page) {
    items.push({
      label: "Open in new tab",
      action: () => {
        (logseq as any).App.pushState("page", { name: data.page });
      },
    });
    items.push({
      label: "Open to the right",
      action: async () => {
        try {
          const page = await (logseq as any).Editor.getPage?.(data.page);
          const id = page?.uuid ?? page?.name ?? data.page;
          await (logseq as any).Editor.openInRightSidebar?.(id);
        } catch (err) {
          console.error("[file-explorer] openInRightSidebar failed:", err);
          toast("Open to the right failed", "warning");
        }
      },
    });
    items.push({
      label: "Open in new window",
      action: async () => {
        const apis = (window as any).top?.apis ?? (window as any).apis;
        const graph = await (logseq as any).App.getCurrentGraph();
        try {
          await apis?.doAction?.(["openNewWindow", (graph as any)?.path]);
        } catch (err) {
          console.error("[file-explorer] openNewWindow failed:", err);
          toast("Open in new window failed", "warning");
        }
      },
    });
    items.push({ divider: true } as MenuItem);
  }

  if (isFile || isPage) {
    items.push({
      label: "Duplicate",
      action: async () => {
        if (!abs) return;
        const dir = dirname(abs);
        const name = basename(abs);
        const ext = extname(name);
        const base = ext ? name.slice(0, -ext.length - 1) : name;
        const dest = joinPath(dir, `${base} (copy)${ext ? "." + ext : ""}`);
        const graph = await (logseq as any).App.getCurrentGraph();
        const ok = await copyFile((graph as any)?.path || "", abs, dest);
        if (ok) toast("Duplicated");
        else toast("Duplicate failed", "warning");
        onReload?.();
      },
    });
    items.push({
      label: "Move file to…",
      action: async () => {
        if (!abs) return;
        const folder = prompt("Move to folder (relative to graph):", dirname(data.path));
        if (folder == null) return;
        const graph = await (logseq as any).App.getCurrentGraph();
        const newPath = joinPath((graph as any)?.path || "", folder, basename(abs));
        const ok = await renamePath(abs, newPath);
        if (ok) toast("Moved");
        else toast(`Move failed: ${getLastFsError() || "unknown error"}`, "warning");
        onReload?.();
      },
    });
  }

  items.push({
    label: "Copy path",
    submenu: [
      {
        label: "Absolute path",
        action: () => copyToClipboard(abs),
      },
      {
        label: "Relative path",
        action: () => copyToClipboard(data.path),
      },
    ],
  });

  if (isFile) {
    items.push({
      label: "Open in default app",
      action: async () => {
        if (!abs) return;
        const apis = (window as any).top?.apis ?? (window as any).apis;
        try {
          if (typeof apis?.openPath === "function") {
            await apis.openPath(abs);
            return;
          }
          const r = await apis?.doAction?.(["openPath", abs]);
          if (r === undefined || r === null) return;
        } catch {
          /* fall through */
        }
        try {
          await (logseq as any).Assets?.builtInOpen?.(abs);
        } catch (err) {
          console.error("[file-explorer] open in default app failed:", err);
          toast("Open failed", "warning");
        }
      },
    });
  }

  items.push({
    label: "Reveal in Finder",
    action: () => {
      if (abs) revealInFinder(abs);
    },
  });

  if (isPage && data.page) {
    items.push({
      label: "Insert link in Journal",
      action: async () => {
        try {
          const Editor = (logseq as any).Editor;
          let todayName: string | undefined;
          try {
            const today = await Editor.getTodayPage?.();
            todayName = today?.name ?? today?.originalName;
          } catch { /* noop */ }
          if (!todayName) {
            const d = new Date();
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            todayName = iso;
          }
          await Editor.appendBlockInPage?.(todayName, `[[${data.page}]]`);
          toast("Inserted into today's journal");
        } catch (err) {
          console.error("[file-explorer] insert-link failed:", err);
          toast("Insert failed", "warning");
        }
      },
    });
  }

  items.push({ divider: true } as MenuItem);

  if (isPage && data.page && data.canonical) {
    items.push({
      label: "Rename…",
      action: async () => {
        const next = prompt("New page name:", data.page);
        if (!next || next === data.page) return;
        try {
          await (logseq as any).Editor.renamePage(data.page, next);
          toast("Renamed");
        } catch {
          toast("Rename failed", "warning");
        }
        onReload?.();
      },
    });
  } else if (isFile || isFolder || (isPage && !data.canonical)) {
    items.push({
      label: "Rename…",
      action: async () => {
        if (!abs) return;
        const cur = basename(abs);
        const next = prompt("New name:", cur);
        if (!next || next === cur) return;
        const dest = joinPath(dirname(abs), next);
        const ok = await renamePath(abs, dest);
        if (ok) toast("Renamed");
        else toast(`Rename failed: ${getLastFsError() || "unknown error"}`, "warning");
        onReload?.();
      },
    });
  }

  items.push({
    label: "Delete",
    action: async () => {
      if (!abs) return;
      if (!confirm(`Delete ${basename(abs)}?`)) return;
      if (isPage && data.page && data.canonical) {
        try {
          await (logseq as any).Editor.deletePage(data.page);
          toast("Deleted");
        } catch {
          toast("Delete failed", "warning");
        }
      } else {
        const graph = await (logseq as any).App.getCurrentGraph();
        const ok = await unlinkPath((graph as any)?.path || "", abs);
        if (ok) toast("Deleted");
        else toast(`Delete failed: ${getLastFsError() || "unknown error"}`, "warning");
      }
      onReload?.();
    },
  });

  return items;
}

async function copyToClipboard(text: string) {
  if (!text) {
    toast("Nothing to copy", "warning");
    return;
  }
  try {
    const apis = (window as any).top?.apis ?? (window as any).apis;
    if (typeof apis?.copyToClipboard === "function") {
      apis.copyToClipboard(text);
      toast("Copied");
      return;
    }
  } catch {
    /* fall through to navigator */
  }
  try {
    const nav = (window as any).top?.navigator ?? navigator;
    await nav.clipboard.writeText(text);
    toast("Copied");
    return;
  } catch {
    /* fall through to textarea */
  }
  try {
    const doc = (window as any).top?.document ?? document;
    const ta = doc.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    doc.body.appendChild(ta);
    ta.select();
    doc.execCommand("copy");
    doc.body.removeChild(ta);
    toast("Copied");
  } catch {
    toast("Copy failed", "warning");
  }
}

function toast(msg: string, kind: "success" | "warning" = "success") {
  try {
    (logseq as any).UI?.showMsg?.(msg, kind);
  } catch {
    /* noop */
  }
}

// Suppress unused warnings for helpers kept for future use
void readFileRaw;
void writeFile;
