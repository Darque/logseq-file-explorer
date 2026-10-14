import "@logseq/libs";
import { state, type View } from "./state";
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

  (logseq as any).useSettingsSchema([
    { key: "nameHideDate", type: "boolean", default: false, title: "Name — Hide date/time", description: "Name tab: hide modification timestamps." },
    { key: "nameNamespaceDepth", type: "number", default: 99, title: "Name — Namespace nesting depth", description: "Name tab: 0 keeps namespaces in the file name; larger values create that many folder levels, combining remaining namespaces in the last folder." },
    { key: "dateHideDate", type: "boolean", default: false, title: "Date — Hide date/time", description: "Date tab: hide modification timestamps." },
    { key: "dateNamespaceDepth", type: "number", default: 0, title: "Date — Namespace nesting depth", description: "Date tab: 0 keeps namespaces in file names; larger values create that many folder levels, combining remaining namespaces in the last folder." },
    { key: "dateRecentHours", type: "number", default: 24, title: "Date — Recent edits (hours)", description: "Edits within this many hours use hour folders; earlier edits in the recent week window use day folders." },
    { key: "dateRecentWeeks", type: "number", default: 1, title: "Date — Recent edits (weeks)", description: "Older files are grouped into one folder. The cutoff is recalculated when the tree loads or refreshes." },
  ]);
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
      if (v === "name" || v === "date") {
        state.view = v;
        state.settingsOpen = false;
        persist();
        rerender();
      }
    },
    toggleSettings() {
      state.settingsOpen = !state.settingsOpen;
      rerender();
    },
    toggleHideDate(e: any) {
      const view = e?.dataset?.view as View;
      if (view !== "name" && view !== "date") return;
      state.viewSettings[view].hideDate = !state.viewSettings[view].hideDate;
      persist();
      rerender();
    },
    changeDepth(e: any) {
      const view = e?.dataset?.view as View;
      if (view !== "name" && view !== "date") return;
      const current = state.viewSettings[view].namespaceDepth;
      const next = e.dataset.value === "all" ? 99 : e.dataset.value === "zero" ? 0 : current + Number(e.dataset.delta);
      if (!Number.isFinite(next)) return;
      state.viewSettings[view].namespaceDepth = Math.max(0, Math.floor(next));
      persist();
      rerender();
    },
    changeRecentWeeks(e: any) {
      const delta = Number(e?.dataset?.delta);
      if (!Number.isFinite(delta)) return;
      state.dateRecentWeeks = Math.max(0, state.dateRecentWeeks + delta);
      persist();
      rerender();
    },
    changeRecentHours(e: any) {
      const delta = Number(e?.dataset?.delta);
      if (!Number.isFinite(delta)) return;
      state.dateRecentHours = Math.max(0, state.dateRecentHours + delta);
      persist();
      rerender();
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

  (logseq as any).onSettingsChanged((newSettings: any) => {
    state.load(newSettings);
    rerender();
  });
  initTooltips();
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

function initTooltips() {
  try {
    const doc = (window as any).top?.document ?? document;
    let timer: any;
    let tip: HTMLElement | null = null;
    let hoveredRow: HTMLElement | null = null;
    const hide = () => { clearTimeout(timer); tip?.remove(); tip = null; hoveredRow = null; };
    doc.addEventListener("pointerover", (event: PointerEvent) => {
      const row = (event.target as HTMLElement | null)?.closest?.("#fe-panel .fe-row[data-tooltip]") as HTMLElement | null;
      if (!row) return;
      if (row === hoveredRow) return;
      hide();
      const label = row.querySelector(".fe-label") as HTMLElement | null;
      if (!label || label.scrollWidth <= label.clientWidth + 1) return;
      hoveredRow = row;
      timer = setTimeout(() => {
        if (!row.isConnected || hoveredRow !== row) return;
        const element = doc.createElement("div") as HTMLElement;
        tip = element;
        element.className = "fe-tooltip";
        element.textContent = row.dataset.tooltip || "";
        doc.body.appendChild(element);
        const rect = row.getBoundingClientRect();
        element.style.left = `${Math.min(rect.left + 24, doc.defaultView.innerWidth - element.offsetWidth - 12)}px`;
        element.style.top = `${Math.min(rect.bottom + 4, doc.defaultView.innerHeight - element.offsetHeight - 12)}px`;
      }, 2000);
    });
    doc.addEventListener("pointerout", (event: PointerEvent) => {
      const row = (event.target as HTMLElement | null)?.closest?.("#fe-panel .fe-row[data-tooltip]");
      const next = (event.relatedTarget as HTMLElement | null)?.closest?.("#fe-panel .fe-row[data-tooltip]");
      if (row && row !== next) hide();
    });
    doc.addEventListener("scroll", hide, true);
  } catch { /* noop */ }
}
