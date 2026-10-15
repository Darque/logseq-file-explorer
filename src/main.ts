import "@logseq/libs";
import { state, type View } from "./state";
import { renderHeaderButton, renderPanel } from "./render";
import { initContextMenu } from "./contextMenu";
import { initDnd } from "./dnd";
import { createNewFile, createNewFolder } from "./newItem";
import cssText from "./styles.css?raw";
import { clearModifiedTimeCache } from "./modifiedTime";
import { ALL_DEPTH, parseNamespaceDepth, parseNonnegativeCount } from "./settingsNumbers";

const HEADER_SELECTOR = ".cp__header .l.drag-region";
const PANEL_SELECTOR = ".left-sidebar-inner > .flex.flex-col.wrap";
const TOOLTIP_MOVE = `
  var row = event.target.closest('.fe-row[data-fe-tooltip]');
  var tip = this.querySelector('.fe-tooltip');
  var label = row && row.querySelector('.fe-label');
  if (!tip || !label || label.scrollWidth <= label.clientWidth + 1) {
    if (tip) tip.hidden = true;
    return;
  }
  tip.textContent = row.dataset.feTooltip;
  tip.style.left = (event.clientX + 8) + 'px';
  tip.style.top = (event.clientY + 12) + 'px';
  tip.hidden = false;
`;
const TOOLTIP_LEAVE = "var tip = this.querySelector('.fe-tooltip'); if (tip) tip.hidden = true";

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
        template: html + '<div class="fe-tooltip" hidden aria-hidden="true"></div>',
        reset: true,
        attrs: { onmouseover: TOOLTIP_MOVE, onmousemove: TOOLTIP_MOVE, onmouseleave: TOOLTIP_LEAVE },
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

  const cur = await logseq.Editor.getCurrentPage();
  if (cur) state.currentPage = (cur as any).originalName ?? (cur as any).name;

  logseq.provideModel({
    togglePanel() {
      state.panelOpen = !state.panelOpen;
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
    toggleRootFolder(e: any) {
      const folder = e?.dataset?.folder;
      if (!state.graphPath || typeof folder !== "string" || !folder || folder.includes("/")) return;
      state.toggleRootFolder(state.graphPath, folder);
      persist();
      rerender();
    },
    changeDepth(e: any) {
      const view = e?.dataset?.view as View;
      if (view !== "name" && view !== "date") return;
      state.viewSettings[view].namespaceDepth = e?.dataset?.value === "all"
        ? ALL_DEPTH : parseNamespaceDepth(String(e?.value ?? ""), state.maxNamespaceDepth);
      persist();
      rerender();
    },
    changeRecentWeeks(e: any) {
      state.dateRecentWeeks = parseNonnegativeCount(String(e?.value ?? ""), 1);
      persist();
      rerender();
    },
    changeRecentHours(e: any) {
      state.dateRecentHours = parseNonnegativeCount(String(e?.value ?? ""), 24);
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
  initContextMenu(() => rerender());
  initDnd(() => rerender());

  await rerender();

  logseq.App.onCurrentGraphChanged(async () => {
    clearModifiedTimeCache();
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
