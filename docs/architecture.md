# Architecture

## Entry point

`logseq.ready(main).catch(console.error)` in `src/main.ts` is the only top-level call. Everything else (listeners, style injection, initial render) happens inside `main()`.

## How the UI is mounted

The plugin runs in a sandboxed iframe. It does not own DOM nodes in the host; instead, every render calls `logseq.provideUI({ path, template, reset: true })`, and Logseq splices the HTML into the host DOM at the selector. Two UI slots:

- **Header button** — `HEADER_SELECTOR = ".cp__header .l.drag-region"`. Template is in `src/render.ts#renderHeaderButton`.
- **Side panel** — `PANEL_SELECTOR = ".left-sidebar-inner > .flex.flex-col.wrap"`. Template is in `src/render.ts#renderPanel`.

Both selectors are **unofficial** — they target Logseq's internal class names. A Logseq UI refactor can break them. If the plugin suddenly renders nothing after a Logseq upgrade, re-inspect the left sidebar and update these two constants first.

## Reaching the host document

The plugin iframe can reach the host via `window.top.document` and `window.top.apis`. Two patterns in the code:

- DOM reads/writes use `(window as any).top?.document ?? document` in `main.ts`, `contextMenu.ts`, and `dnd.ts`.
- IPC is centralized in `src/fsOps.ts#getApis`. It tries `window.top.apis` then `window.apis`. The Name view falls back to `Editor.getAllPages` without filesystem IPC; Date requires a file-based graph.

## Click routing via `provideModel`

Logseq's UI templates use `data-on-click="methodName"` attributes, dispatched through `logseq.provideModel`. The model is registered once in `src/main.ts`.

This means row clicks (open page, open file, toggle folder) all go through `provideModel`. Right-click and drag events bypass it entirely and use native listeners on the host document — that's why `contextMenu.ts` and `dnd.ts` register directly on `window.top.document`.

## Render loop

`rerender()` in `src/main.ts` is the single render entry point. It:

1. Dedupes with `rerenderQueued` + `queueMicrotask` — multiple triggers inside the same event loop tick coalesce to one render. Without this, a batch of `DB.onChanged` events would cause N renders.
2. Injects header and panel via `provideUI({ reset: true })`.
3. Calls `ensurePanelContainerRelative()` so the absolutely positioned panel stays within the sidebar.

## Listeners that trigger rerender

Wired near the end of `main()`:

- `App.onCurrentGraphChanged` — clears modified-time cache and rerenders for the new graph.
- `App.onRouteChanged` — page navigation. Updates `state.currentPage` (for the `is-active` row highlight).
- `App.onSidebarVisibleChanged` — rerender when the left sidebar opens/closes.
- `DB.onChanged` — clears modified-time cache and rerenders after a 500ms debounce. The toolbar Refresh button is the user-facing escape hatch when the tree goes stale.

## State + persistence

`src/state.ts` holds a singleton `State` instance. Persisted fields include the active view, panel visibility, open folders, per-view settings, recent edit windows, and per-graph root-folder selections. Runtime-only fields include the active page, graph path, and journal date format.

- `state.load(logseq.settings)` runs at startup.
- `persist()` debounces `logseq.updateSettings(state.dump())` by 200ms. Use it for click-driven state changes.

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
    pagesTree.ts   Name tree from files, with Editor.getAllPages fallback
```
