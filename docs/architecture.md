# Architecture

## Entry point

`src/main.ts:161` — `logseq.ready(main).catch(console.error)` is the only top-level call. Everything else (listeners, style injection, initial render) happens inside `main()`.

## How the UI is mounted

The plugin runs in a sandboxed iframe. It does not own DOM nodes in the host; instead, every render calls `logseq.provideUI({ path, template, reset: true })`, and Logseq splices the HTML into the host DOM at the selector. Two UI slots:

- **Header button** — `src/main.ts:9` `HEADER_SELECTOR = ".cp__header .l.drag-region"`. Template is in `src/render.ts#renderHeaderButton` (line 12).
- **Side panel** — `src/main.ts:10` `PANEL_SELECTOR = ".left-sidebar-inner > .flex.flex-col.wrap"`. Template is in `src/render.ts#renderPanel` (line 21).

Both selectors are **unofficial** — they target Logseq's internal class names. A Logseq UI refactor can break them. If the plugin suddenly renders nothing after a Logseq upgrade, re-inspect the left sidebar and update these two constants first.

## Reaching the host document

The plugin iframe can reach the host via `window.top.document` and `window.top.apis`. Two patterns in the code:

- DOM reads/writes (e.g., finding the panel element): `(window as any).top?.document ?? document` — see `src/main.ts:53`, `src/contextMenu.ts:30`, `src/dnd.ts:9`. The `?? document` fallback exists because the iframe may be same-origin without `top`.
- IPC: centralized in `src/fsOps.ts#getApis` (line 16). Tries `window.top.apis` first, then `window.apis`. Returns `null` when neither exists (e.g., DB-only or browser builds) — callers then degrade gracefully (Files view shows an error row; Pages view still works because it uses `Editor.getAllPages`).

## Click routing via `provideModel`

Logseq's UI templates can't attach real DOM event listeners (the plugin doesn't own the nodes). Instead, HTML includes `data-on-click="methodName"` attributes, and `logseq.provideModel({ methodName(e) { ... } })` registers handlers that Logseq dispatches on matching clicks. The model is registered once in `src/main.ts:85-136`.

This means row clicks (open page, open file, toggle folder) all go through `provideModel`. Right-click and drag events bypass it entirely and use native listeners on the host document — that's why `contextMenu.ts` and `dnd.ts` register directly on `window.top.document`.

## Render loop

`rerender()` in `src/main.ts:22-49` is the single render entry point. It:

1. Dedupes with `rerenderQueued` + `queueMicrotask` — multiple triggers inside the same event loop tick coalesce to one render. Without this, a batch of `DB.onChanged` events would cause N renders.
2. Injects header and panel via `provideUI({ reset: true })`.
3. Calls `ensurePanelContainerRelative()` (line 51) to force `position: relative` on `.left-sidebar-inner > .flex.flex-col.wrap` if its computed style is `static`. Our `.fe-panel` uses `position: absolute; inset: 0` (`src/styles.css:17`), so the container must be a positioning context.

## Listeners that trigger rerender

Wired near the end of `main()` (`src/main.ts:143-158`):

- `App.onCurrentGraphChanged` — user switches graph. Refreshes `state.graphName` then rerenders.
- `App.onRouteChanged` — page navigation. Updates `state.currentPage` (for the `is-active` row highlight).
- `App.onSidebarVisibleChanged` — rerender when the left sidebar opens/closes.
- `DB.onChanged` — debounced to 500ms (`src/main.ts:157`). Covers most page mutations, **but** sometimes misses native rename-page operations. The toolbar Refresh button (`src/render.ts:57` → `provideModel.refresh`) is the user-facing escape hatch when the tree goes stale.

## State + persistence

`src/state.ts` holds a singleton `State` instance. Persisted fields: `view`, `panelOpen`, `rootCollapsed`, `openFolders` (serialized as array). Runtime-only fields: `open` (Set, derived from `openFolders` on load), `currentPage`, `graphName`, `dateFormat`.

- `state.load(logseq.settings)` at startup — `src/main.ts:70`.
- `persist()` is a 200ms debounced `logseq.updateSettings(state.dump())` — `src/main.ts:63`. Every state-mutating model method calls `persist()` then `rerender()`. Never call `logseq.updateSettings` directly from a click handler; funnel through `persist()` or you'll write on every click.

## File layout

```
src/
  main.ts          entry, listeners, model, render loop
  state.ts         persisted + runtime state singleton
  render.ts        header button + panel HTML
  fsOps.ts         IPC wrappers, path helpers, lastError plumbing
  newItem.ts       createNewFile / createNewFolder prompts
  contextMenu.ts   right-click menu (host document listener)
  dnd.ts           drag-and-drop (host document listener)
  styles.css       all CSS, injected via logseq.provideStyle
  trees/
    types.ts       TreeNode interface
    fsTree.ts      readdir-based tree + journal date formatter
    pagesTree.ts   Editor.getAllPages-based tree
```
