# Drag & drop

All logic is in `src/dnd.ts`. Like `contextMenu.ts`, it registers listeners on the host document (`window.top.document`) because the plugin iframe can't receive drag events for host-rendered DOM.

## Wiring

`initDnd(reload)` (line 7) registers five listeners in capture phase:

- `dragstart` — mark the source row, stash path in `dataTransfer`
- `dragover` — compute drop target, toggle `.drop-target` highlight, call `preventDefault` to allow drop
- `dragleave` — clear highlight on row exit
- `drop` — resolve drop target, call `renamePath`, trigger reload
- `dragend` — cleanup (strip `.is-dragging` from any row)

Rows declare `draggable="true"` in `src/render.ts:107, 125` — both leaves and folders are draggable.

## Pages are not draggable

`onDragStart` (line 18-34) rejects non-fs sources:

```ts
if (src !== "fs") {
  // Pages are name-indexed, not path-indexed — block drag-to-move for pages.
  e.preventDefault();
  return;
}
```

Dragging a Pages-view row would have no meaningful target semantics — Logseq pages live in a name-indexed namespace, not a path. Drag-to-move only works in the Files view.

## MIME type

`src/dnd.ts:3` — `const MIME = "application/x-fe-path"`. Using a custom MIME type means our `dragover` handler can filter out drags that didn't originate in our panel (line 44-45):

```ts
const types = Array.from(e.dataTransfer?.types || []);
if (!types.includes(MIME)) return;
```

Without this, dragging anything from outside the panel (e.g., a file from Finder, selected text) would also trigger drop highlighting.

## Drop target resolution

`resolveDropTarget` (line 118-147) branches on what's under the pointer:

1. **Folder row** → drop INTO that folder. Rejected if:
   - folder is the source itself (`relPath === srcPath`)
   - folder is a descendant of the source (`relPath.startsWith(srcPath + "/")`)
   - source's parent is already this folder (`dirname(srcPath) === relPath`) — no-op
2. **File/page row** → drop into its parent folder (hover-on-sibling pattern). Rejected if already siblings.
3. **Empty list area** → drop at graph root. Rejected if source is already at root.

The destination path is always `joinPath(graphPath, dropTargetRelPath, basename(srcPath))` — the move preserves the file's basename and just changes its parent directory.

## Drop execution

`onDrop` (line 77-111) calls `renamePath(absFrom, absTo)` and shows a toast with `getLastFsError()` on failure. After the move, `onReload?.()` triggers a re-render — the tree has to re-read because our tree is built from `readdir`, not mutated in place.

## Self / descendant rejection — worked example

```
pages/
  Foo.md
  Folder A/
    Bar.md
```

- Drag `pages/Foo.md` onto `pages/Folder A/` → destination `pages/Folder A/Foo.md`. Allowed.
- Drag `pages/Folder A/` onto `pages/Folder A/Bar.md` → drop target resolved to `pages/Folder A/` (parent of Bar). `dirname(srcPath) === "pages"` but `relPath === "pages/Folder A"`, so... wait — no, this hits rule 2 (file row) with `parent === "pages/Folder A"`, then `dirname(srcPath) === "pages" !== parent`, so it would NOT reject via the "already there" rule. BUT rule 1 doesn't apply because this is a file row, not folder. This case is actually **dropping the folder onto its own child**, which rule 2 currently allows. The fs operation would become `rename pages/Folder A → pages/Folder A/Folder A` — an invalid self-nesting rename. In practice Logseq's IPC / Node's fs rejects this, so the user sees a toast failure. If this bug turns into a ticket, add a descendant check to the file-row branch too.
- Drag `pages/Folder A/` onto itself → rejected by rule 1 (`relPath === srcPath`).

## Visual feedback

- Source row gets `.is-dragging` → 50% opacity (`src/styles.css:202`).
- Drop target row/list gets `.drop-target` → active-primary-color background + dashed outline (`src/styles.css:203-211`).

`clearDropHighlights()` (line 157) is called in `dragover`, `drop`, and `dragend` to ensure only one highlight is active at a time across the whole panel.

## Error surfacing

Uses the same `lastError` plumbing as everything else:

```ts
// src/dnd.ts:107-109
const ok = await renamePath(absFrom, absTo);
if (ok) toast("Moved");
else toast(`Move failed: ${getLastFsError() || "unknown error"}`, "warning");
```

See [ipc.md](ipc.md) for why `rename` can fail even when `await` resolves without throwing (rename actually does throw — but the lastError pattern is shared across ops for consistency).
