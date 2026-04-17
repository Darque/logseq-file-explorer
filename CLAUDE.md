# logseq-file-explorer

Obsidian-style file explorer plugin for Logseq's left sidebar. See `docs/` before changing code.

## Read first

- [Architecture](docs/architecture.md) — how the plugin mounts, renders, and listens
- [IPC](docs/ipc.md) — **critical gotchas** around Logseq's error-as-value IPC handlers
- [Canonical pages](docs/canonical-pages.md) — why rename/delete routes differ for `pages/` + `journals/` vs other `.md`
- [Context menu](docs/context-menu.md) — click dispatch, positioning, per-item APIs
- [Trees](docs/trees.md) — fs tree vs pages tree, journal date formatting
- [Drag & drop](docs/dnd.md)
- [Styling](docs/styling.md) — theme sync via Logseq CSS vars
- [Build & load](docs/build-and-load.md)

## Reference

Logseq source is read-only at `/tmp/logseq/`. See [build-and-load.md](docs/build-and-load.md#reference).

## Build

`npm run build` → `dist/`. Reload plugin in Logseq after each build.
