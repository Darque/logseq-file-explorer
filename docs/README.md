# logseq-file-explorer — Developer Docs

An Obsidian-style file explorer pinned to Logseq's left sidebar. It renders two tree views (Files / Pages), supports drag-and-drop moves, a rich right-click menu, new file/folder creation, and rename/delete. All cross-cutting gotchas — most of them non-obvious unless you've debugged them live — are captured in the docs below.

## Read in this order

1. [architecture.md](architecture.md) — mount points, render loop, listener wiring, state persistence
2. [ipc.md](ipc.md) — **read before touching any filesystem operation.** Logseq's Clojure IPC handlers often return errors as resolved values; try/catch alone will silently swallow failures.
3. [canonical-pages.md](canonical-pages.md) — why `pages/*.md` and `journals/*.md` must route through the Logseq page API, while every other `.md` goes through raw fs ops. Covers the ghost-file bug.
4. [context-menu.md](context-menu.md) — right-click handling, positioning, click-dispatch fix, per-item API table
5. [trees.md](trees.md) — fs tree vs pages tree, ignored paths, journal date formatting
6. [dnd.md](dnd.md) — drag-and-drop move semantics and rejection rules
7. [styling.md](styling.md) — Logseq CSS var usage and the Monaco class-name trick
8. [build-and-load.md](build-and-load.md) — dev loop + pointer to the Logseq source tree

## Cardinal rules

- Never assume `await apis.doAction([...])` throws on failure. See [ipc.md](ipc.md).
- Never call `Editor.deletePage` on a non-canonical `.md` file. See [canonical-pages.md](canonical-pages.md).
- Never write `state` on every click — go through the 200ms debounced `persist()` in `src/main.ts:63`.
- Never hardcode colors — always use the `--ls-*` CSS vars so themes follow. See [styling.md](styling.md).
