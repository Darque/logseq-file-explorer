# Context menu

All logic lives in `src/contextMenu.ts`.

## Listener wiring

`initContextMenu(reload)` (line 28) registers three listeners on the **host document** (`window.top.document`) with `capture: true`:

- `contextmenu` — `handleContextMenu` (line 37): builds + opens the menu
- `click` — `handleDocClick` (line 64): closes the menu when clicking outside
- `keydown` — `handleKey` (line 72): Escape closes the menu

Capture phase is important. The click-outside handler runs **before** the menu-item click bubbles, so we can early-return when the click originated inside the menu and let the item's own (bubble-phase) handler fire.

## Click dispatch fix

`handleDocClick` uses `target.closest(".fe-ctx-menu")` (line 68), NOT `menu.contains(target)`:

```ts
// src/contextMenu.ts:64-70
function handleDocClick(e: MouseEvent) {
  if (!currentMenu) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest?.(".fe-ctx-menu")) return;  // inside any fe menu → let it through
  closeMenu();
}
```

Reason: the click target might be a deep child (text node or the ▸ arrow span). `Node.contains()` plus manual ancestor checks were brittle — clicks on the arrow in a submenu item would sometimes misroute. `closest()` walks up to the nearest `.fe-ctx-menu` ancestor reliably, regardless of how deep the inner span nesting goes, and matches BOTH top-level menus and submenus (they share the class).

## Item click listeners

Registered in **bubble phase** (default) on each `.fe-ctx-item` in `renderItem` (line 154):

```ts
row.addEventListener("click", async (e) => {
  e.stopPropagation();
  closeMenu();
  try { await item.action!(); }
  catch (err) { console.error(...); }
});
```

Order of events on a valid item click:

1. Capture: `handleDocClick` fires, finds `.fe-ctx-menu` ancestor, returns without closing.
2. Bubble: item's `click` handler fires, calls `closeMenu()`, runs `item.action()`.

If you ever swap the listeners to capture phase, the close-outside handler would fire first and the action would be lost.

## Positioning

`.fe-ctx-menu` uses `position: absolute` (`src/styles.css:228`), NOT `fixed`. Fixed positioning was unreliable because the panel sits inside Logseq containers that can have CSS transforms, which break the fixed-viewport assumption.

The menu is appended to `window.top.document.body` and positioned with `e.pageX` / `e.pageY` in `positionMenu` (line 168). An rAF-based overflow correction flips the menu if it would run off the right/bottom viewport edges.

Submenus are positioned with `rect.right + scrollX, rect.top + scrollY` off the parent item (line 134-144). They use `position: absolute` too, and append to `host.body` so they escape any `overflow: hidden` clipping ancestor.

## Submenu cleanup

`closeMenu()` (line 76) queries and removes **all** `.fe-ctx-menu` elements on the host:

```ts
host.querySelectorAll(".fe-ctx-menu").forEach((el) => el.remove());
```

Not just `currentMenu`. Earlier versions tracked submenus individually and leaked them when the mouse left fast — this sweep ensures nothing dangles, regardless of how many submenus are open or in transition.

## Empty-area right-click

When the context menu fires inside the panel but not on a row, `handleContextMenu` (line 49) falls back to `emptyAreaMenuItems()` (line 188), which offers New file / New folder at the graph root.

## Item catalog

All items produced by `menuItemsFor(data)` starting at line 195:

| Item | Applies to | Implementation | Notes |
|---|---|---|---|
| New file | folder | `createNewFile(data.path)` | prompts for name, `writeFile(repo, abs, "")` |
| New folder | folder | `createNewFolder(data.path)` | `mkdir(abs, true)` |
| Open in new tab | page | `App.pushState("page", { name })` | |
| Open to the right | page | `Editor.getPage(name)` → `openInRightSidebar(page.uuid)` | **uuid, not name**, line 226-228 |
| Open in new window | page | `apis.doAction(["openNewWindow", graph.path])` | **path, not name**, line 241 |
| Duplicate | file/page | `copyFile(repo, abs, abs + " (copy)")` | see [ipc.md](ipc.md) caveat |
| Move file to… | file/page | prompts, `renamePath(abs, newAbs)` | |
| Copy path → Absolute | any | `copyToClipboard(abs)` | fallback chain: apis → navigator → textarea |
| Copy path → Relative | any | `copyToClipboard(data.path)` | |
| Open in default app | file | `apis.openPath(abs)` → `doAction(["openPath", abs])` → `Assets.builtInOpen(abs)` | line 298-322 |
| Reveal in Finder | any | `revealInFinder(abs)` → `doAction(["openFileInFolder", abs])` | `openFileInFolder` **reveals** (doesn't open) — see [ipc.md](ipc.md) |
| Insert link in Journal | page | `Editor.getTodayPage()` → `appendBlockInPage(today.name, "[[page]]")` | `"journal"` is NOT a valid page id — falls back to synthesized `YYYY-MM-DD` |
| Rename… | file/folder/page | canonical-aware, see [canonical-pages.md](canonical-pages.md) | |
| Delete | file/folder/page | canonical-aware, see [canonical-pages.md](canonical-pages.md) | |

## `extractRowData`

Line 82-95. Reads from dataset attributes on the row:

- `data-kind` — `"page" | "file" | "folder"`
- `data-source` — `"page" | "fs"` (which tree produced it)
- `data-path` — relative path or page name
- `data-page` — page name (if applicable)
- `data-canonical` — `"1"` if canonical, else absent

Absolute path is synthesized by joining `panel.dataset.graphPath` with `data-path`. Everything downstream works off the `RowData` object, not the raw element.
