import "@logseq/libs";
import { state } from "./state";
import { renderHeaderButton, renderPanel } from "./render";
import { initContextMenu } from "./contextMenu";
import { initDnd } from "./dnd";
import { createNewFile, createNewFolder } from "./newItem";
import cssText from "./styles.css?raw";
import { clearModifiedTimeCache } from "./modifiedTime";

const HEADER_SELECTOR = ".cp__header .l.drag-region";
const PANEL_SELECTOR = ".left-sidebar-inner > .flex.flex-col.wrap";

let rerenderQueued = false;

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function rerender() {
  if (rerenderQueued) return;
  rerenderQueued = true;
  queueMicrotask(async () => {
    rerenderQueued = false;
    try {
      logseq.provideUI({
        key: "fe-header",
        path: HEADER_SELECTOR,
        template: renderHeaderButton(state),
        reset: true,
        style: { display: "inline-flex", alignItems: "center" },
      } as any);

      const { html } = await renderPanel(state);
      logseq.provideUI({
        key: "fe-panel",
        path: PANEL_SELECTOR,
        template: html,
        reset: true,
      } as any);

      ensurePanelContainerRelative();
    } catch (e) {
      console.error("[file-explorer] render failed:", e);
    }
  });
}

function ensurePanelContainerRelative() {
  try {
    const doc = (window as any).top?.document ?? document;
    const el = doc.querySelector(PANEL_SELECTOR) as HTMLElement | null;
    if (el && getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }
  } catch {
    /* noop */
  }
}

const persist = debounce(() => {
  logseq.updateSettings(state.dump());
}, 200);

async function main() {
  logseq.provideStyle({ key: "fe-styles", style: cssText } as any);

  state.load(logseq.settings as any);

  try {
    const cfg: any = await (logseq.App as any).getUserConfigs?.();
    if (cfg?.preferredDateFormat) state.dateFormat = cfg.preferredDateFormat;
  } catch {
    /* noop */
  }

  const g = await logseq.App.getCurrentGraph();
  state.graphName = (g as any)?.name ?? "graph";

  const cur = await logseq.Editor.getCurrentPage();
  if (cur) state.currentPage = (cur as any).originalName ?? (cur as any).name;

  logseq.provideModel({
    togglePanel() {
      state.panelOpen = !state.panelOpen;
      persist();
      rerender();
    },
    toggleRoot() {
      state.rootCollapsed = !state.rootCollapsed;
      persist();
      rerender();
    },
    switchView(e: any) {
      const v = e?.dataset?.view;
      if (v === "pages" || v === "fs") {
        state.view = v;
        persist();
        rerender();
      }
    },
    toggleFolder(e: any) {
      const p = e?.dataset?.path;
      if (!p) return;
      state.toggleFolder(p);
      persist();
      rerender();
    },
    openPage(e: any) {
      const name = e?.dataset?.page;
      if (name) logseq.App.pushState("page", { name });
    },
    openFile(e: any) {
      const p = e?.dataset?.path;
      if (!p) return;
      const doc = (window as any).top?.document ?? document;
      const panel = doc.querySelector("#fe-panel") as HTMLElement | null;
      const graphPath = panel?.dataset.graphPath || "";
      const abs = graphPath ? `${graphPath}/${p}` : p;
      const apis = (window as any).top?.apis;
      apis?.doAction(["openFileInFolder", abs]).catch(() => {});
    },
    async newFile() {
      await createNewFile();
      rerender();
    },
    async newFolder() {
      await createNewFolder();
      rerender();
    },
    refresh() {
      clearModifiedTimeCache();
      rerender();
    },
  });

  initContextMenu(() => rerender());
  initDnd(() => rerender());

  await rerender();

  logseq.App.onCurrentGraphChanged(async () => {
    clearModifiedTimeCache();
    const g = await logseq.App.getCurrentGraph();
    state.graphName = (g as any)?.name ?? "graph";
    rerender();
  });
  logseq.App.onRouteChanged(async () => {
    const cur = await logseq.Editor.getCurrentPage();
    state.currentPage = cur
      ? ((cur as any).originalName ?? (cur as any).name)
      : null;
    rerender();
  });
  logseq.App.onSidebarVisibleChanged(() => rerender());

  const debouncedRerender = debounce(() => rerender(), 500);
  logseq.DB.onChanged(() => {
    clearModifiedTimeCache();
    debouncedRerender();
  });
}

logseq.ready(main).catch(console.error);
