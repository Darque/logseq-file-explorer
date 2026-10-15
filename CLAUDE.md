# logseq-file-explorer

Alpha-stage personal-use file explorer plugin for Logseq's left sidebar. See `README.md` and `docs/` before changing code.

This checkout lives at `/Users/phil/ai/logseq-file-explorer`. Read `AGENTS.md` and `.agents/skills/logseq-file-explorer/SKILL.md` for repository boundaries and the screenshot fixture.

## Read first

- [Architecture](docs/architecture.md) — how the plugin mounts, renders, and listens
- [IPC](docs/ipc.md) — **critical gotchas** around Logseq's error-as-value IPC handlers
- [Canonical pages](docs/canonical-pages.md) — why rename/delete routes differ for `pages/` + `journals/` vs other `.md`
- [Context menu](docs/context-menu.md) — click dispatch, positioning, per-item APIs
- [Trees](docs/trees.md) — Name and Date grouping, root selection, journal date formatting
- [Drag & drop](docs/dnd.md)
- [Styling](docs/styling.md) — theme sync via Logseq CSS vars
- [Build & load](docs/build-and-load.md)

## Build

`npm run build` → `dist/`. Reload plugin in Logseq after each build.
