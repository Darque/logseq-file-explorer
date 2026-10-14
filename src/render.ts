import type { State } from "./state";
import type { TreeNode } from "./trees/types";
import { buildPagesTree } from "./trees/pagesTree";
import { buildFsTree, extOf, stripExt } from "./trees/fsTree";
import { addModifiedTimes, dateTree, formatModifiedTime } from "./modifiedTime";

const ICON_FOLDER_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-folder" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"/></svg>`;

const ICON_CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-chevron-right" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="9 6 15 12 9 18"/></svg>`;

export function renderHeaderButton(state: State): string {
  return `<button id="fe-toggle-btn" title="Toggle File Explorer" aria-label="Toggle File Explorer" aria-pressed="${state.panelOpen}" class="button icon fe-toolbar-btn" data-on-click="togglePanel">
    ${ICON_FOLDER_CLOSED}
  </button>`;
}

export async function renderPanel(
  state: State,
): Promise<{ html: string; graphPath?: string }> {
  if (!state.panelOpen) {
    return { html: `<div id="fe-panel" class="fe-panel fe-hidden"></div>` };
  }

  let body: string;
  let graphPath: string | undefined;

  const settings = state.viewSettings[state.view];
  if (state.settingsOpen) {
    body = renderSettings(state);
  } else if (state.view === "name") {
    const graph = await logseq.App.getCurrentGraph();
    graphPath = (graph as any)?.path;
    const tree = await buildPagesTree(settings.namespaceDepth);
    await addModifiedTimes(tree, graphPath, (path) => state.isOpen(path));
    body = tree.length ? renderRows(tree, 0, state, "page", settings.hideDate) : emptyRow("No pages");
  } else {
    const graph = await logseq.App.getCurrentGraph();
    graphPath = (graph as any)?.path;
    const res = await buildFsTree();
    graphPath = res.graphPath || graphPath;
    await addModifiedTimes(res.tree, graphPath, () => true, true);
    const tree = dateTree(res.tree, settings.namespaceDepth, state.dateRecentWeeks, state.dateRecentHours);
    if (res.error && !tree.length) body = emptyRow(res.error);
    else body = tree.length ? renderRows(tree, 0, state, "page", settings.hideDate) : emptyRow("No dated files");
  }

  const activeName = state.view === "name" ? "active" : "";
  const activeDate = state.view === "date" ? "active" : "";

  const html = `
<div id="fe-panel" class="fe-panel" data-graph-path="${esc(graphPath || "")}">
  <div class="fe-tabs">
    <div class="fe-tabs-inner">
      <button type="button" data-on-click="switchView" data-view="name" class="fe-tab ${activeName}" aria-pressed="${state.view === "name"}">Name</button>
      <button type="button" data-on-click="switchView" data-view="date" class="fe-tab ${activeDate}" aria-pressed="${state.view === "date"}">Date</button>
    </div>
    <div class="fe-tabs-actions">
      <button class="fe-tab-btn" title="New file" data-on-click="newFile"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M12 11l0 6"/><path d="M9 14l6 0"/></svg></button>
      <button class="fe-tab-btn" title="New folder" data-on-click="newFolder"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 19h-7a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v3.5"/><path d="M16 19h6"/><path d="M19 16v6"/></svg></button>
      <button class="fe-tab-btn" title="Refresh" data-on-click="refresh"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg></button>
      <button class="fe-tab-btn ${state.settingsOpen ? "active" : ""}" title="File Explorer settings" aria-label="File Explorer settings" aria-pressed="${state.settingsOpen}" data-on-click="toggleSettings"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0 -8"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1l-2 2l-.1-.1a1.7 1.7 0 0 0 -1.9-.3a1.7 1.7 0 0 0 -1 1.5v.2h-2.8v-.2a1.7 1.7 0 0 0 -1-1.5a1.7 1.7 0 0 0 -1.9.3l-.1.1l-2 -2l.1-.1a1.7 1.7 0 0 0 .3-1.9a1.7 1.7 0 0 0 -1.5-1h-.2v-2.8h.2a1.7 1.7 0 0 0 1.5-1a1.7 1.7 0 0 0 -.3-1.9l-.1-.1l2 -2l.1.1a1.7 1.7 0 0 0 1.9.3a1.7 1.7 0 0 0 1-1.5v-.2h2.8v.2a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.9-.3l.1-.1l2 2l-.1.1a1.7 1.7 0 0 0 -.3 1.9a1.7 1.7 0 0 0 1.5 1h.2v2.8h-.2a1.7 1.7 0 0 0 -1.5 1z"/></svg></button>
    </div>
  </div>
  ${state.settingsOpen ? body : `<div class="monaco-list" data-drop-root="${esc(graphPath || "")}">
    <div class="monaco-list-rows">${body}</div>
  </div>`}
</div>`;
  return { html, graphPath };
}

function renderSettings(state: State): string {
  return `<div class="fe-settings">
    <h2>File Explorer settings</h2>
    ${(["name", "date"] as const).map((view) => {
      const settings = state.viewSettings[view];
      return `<section class="fe-settings-section">
        <h3>${view === "name" ? "Name" : "Date"} tab</h3>
        <button class="fe-setting-check" role="checkbox" aria-checked="${settings.hideDate}" data-on-click="toggleHideDate" data-view="${view}"><span class="fe-checkbox">${settings.hideDate ? "✓" : ""}</span> Hide file date/time</button>
        <div class="fe-setting-counter"><span>Namespace nest depth</span><div class="fe-counter-actions">
          <button data-on-click="changeDepth" data-view="${view}" data-value="zero" title="No namespace folders">0</button>
          <button data-on-click="changeDepth" data-view="${view}" data-delta="-1" title="Decrease nesting">−</button>
          <output>${settings.namespaceDepth === 99 ? "All" : settings.namespaceDepth}</output>
          <button data-on-click="changeDepth" data-view="${view}" data-delta="1" title="Increase nesting">+</button>
          <button data-on-click="changeDepth" data-view="${view}" data-value="all" title="Nest all namespaces">All</button>
        </div></div>
        ${view === "date" ? `<div class="fe-setting-counter"><span>Recent edits (hours)</span><div class="fe-counter-actions">
          <button data-on-click="changeRecentHours" data-delta="-1" title="Fewer hours">−</button>
          <output>${state.dateRecentHours}</output>
          <button data-on-click="changeRecentHours" data-delta="1" title="More hours">+</button>
        </div></div><div class="fe-setting-counter"><span>Recent edits (weeks)</span><div class="fe-counter-actions">
          <button data-on-click="changeRecentWeeks" data-delta="-1" title="Fewer weeks">−</button>
          <output>${state.dateRecentWeeks}</output>
          <button data-on-click="changeRecentWeeks" data-delta="1" title="More weeks">+</button>
        </div></div>` : ""}
        <p>0 keeps the namespace in the file name. Each higher level creates one namespace folder.</p>
        ${view === "date" ? "<p>Edits within the hour window use hour folders. Other edits within the week window use day folders. Earlier files appear in Older files. Cutoffs are recalculated when the tree loads or refreshes.</p>" : ""}
      </section>`;
    }).join("")}
  </div>`;
}

type Source = "page" | "fs";

function renderRows(
  nodes: TreeNode[],
  depth: number,
  state: State,
  source: Source,
  hideDate: boolean,
): string {
  return nodes.map((n) => renderRow(n, depth, state, source, hideDate)).join("");
}

function renderRow(
  n: TreeNode,
  depth: number,
  state: State,
  source: Source,
  hideDate: boolean,
): string {
  const indent = renderIndent(depth);
  if (n.isLeaf) {
    const active =
      n.pageName && state.currentPage &&
        n.pageName.toLowerCase() === state.currentPage.toLowerCase()
        ? "is-active"
        : "";
    const isPage = !!n.pageName;
    const kind = isPage ? "page" : "file";
    const click = isPage
      ? `data-on-click="openPage" data-page="${esc(n.pageName!)}"`
      : `data-on-click="openFile" data-path="${esc(n.path)}"`;
    const ext = extOf(n.name);
    const showExt = source === "fs" && !!ext;
    const label = source === "fs" && ext
      ? esc(stripExt(n.name))
      : esc(displayName(n.name));
    const extSpan = showExt
      ? `<span class="fe-ext">${esc(ext)}</span>`
      : "";
    const pageAttr = n.pageName ? `data-page="${esc(n.pageName)}"` : "";
    const canonicalAttr = n.canonicalPage ? `data-canonical="1"` : "";
    const modified = !hideDate && Number.isFinite(n.modifiedAt)
      ? `<time class="fe-modified" datetime="${new Date(n.modifiedAt!).toISOString()}">${formatModifiedTime(n.modifiedAt!)}</time>`
      : "";

    return `<div class="monaco-list-row fe-row ${active}" draggable="true" data-kind="${kind}" data-source="${source}" data-path="${esc(n.path)}" ${pageAttr} ${canonicalAttr} ${click} data-tooltip="${esc(n.displayName || n.name)}" aria-label="${esc(n.displayName || n.name)}">
      <div class="monaco-tl-row">
        ${indent}
        <div class="monaco-tl-twistie fe-spacer"></div>
        <div class="monaco-tl-contents">
          <span class="fe-label">${label}</span>
          ${extSpan}
          ${modified}
        </div>
      </div>
    </div>`;
  }

  const isOpen = state.isOpen(n.path);
  const twistieCls = isOpen ? "expanded" : "collapsed";
  const children = isOpen && n.children
    ? renderRows(n.children, depth + 1, state, source, hideDate)
    : "";

  return `<div class="monaco-list-row fe-row fe-folder" draggable="${source === "fs" && !n.virtual}" data-kind="folder" data-source="${source}" data-path="${esc(n.path)}" ${n.virtual ? 'data-virtual="1"' : ""} data-on-click="toggleFolder" aria-label="${esc(n.name)}">
    <div class="monaco-tl-row">
      ${indent}
      <div class="monaco-tl-twistie ${twistieCls}">${ICON_CHEVRON}</div>
      <div class="monaco-tl-contents">
        <span class="fe-label">${esc(n.name)}</span>
      </div>
    </div>
  </div>${children}`;
}

function renderIndent(depth: number): string {
  if (depth === 0) return "";
  let guides = "";
  for (let i = 0; i < depth; i++) {
    guides += `<div class="indent-guide"></div>`;
  }
  return `<div class="monaco-tl-indent" style="width:${depth * 14}px">${guides}</div>`;
}

function emptyRow(msg: string): string {
  return `<div class="fe-empty">${esc(msg)}</div>`;
}

function displayName(name: string): string {
  return name.replace(/___/g, "/");
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
