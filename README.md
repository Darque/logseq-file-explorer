<div align="center">
  <img src="icon.svg" width="128" height="128" alt="Logseq File Explorer">

  <h1>Logseq File Explorer</h1>

  <p>An Obsidian-style file explorer for Logseq's left sidebar.<br/>
  Browse pages by namespace or the raw filesystem, with drag-and-drop and a full right-click menu.</p>
</div>

---

## Features

- **Two views:** _Name_ (graph folders and namespaces) and _Date_ (edited-time folders with namespace nesting).
- **Native feel:** matches Logseq's sidebar spacing, colors, and typography.
- **Right-click menu:** new file/folder, duplicate, rename, move, delete, copy path, reveal in Finder, open in default app, open to the right / new window, insert link in today's journal.
- **Drag-and-drop:** move files between folders with drop-target highlighting.
- **Journal-aware:** files under `journals/` render with your configured date format.
- **Edited dates:** each view can show local `dd/mm/yy hh:mm` timestamps in an aligned column, with independent namespace depth settings.
- **Graph folder filter:** check the graph's root folders in File Explorer settings to choose which files appear in both trees. The list updates when the tree refreshes or the graph changes; choices are saved per graph. Logseq's metadata folder starts unchecked.
- **Safe file ops:** canonical Logseq pages (under `pages/`, `journals/`) use Logseq's own rename/delete to keep links intact; other files use direct filesystem ops.
- **Toolbar actions:** New file / New folder / Refresh buttons next to the tab switcher.
- **Header toggle:** one-click show/hide button in the Logseq title bar.

## Installation

### From source

1. Clone this repository:
   ```bash
   git clone https://github.com/Darque/logseq-file-explorer.git
   cd logseq-file-explorer
   ```
2. Install and build:
   ```bash
   npm install
   npm run build
   ```
3. In Logseq Desktop: **Settings → Advanced → Developer mode** (on).
4. Top-right ⋯ menu → **Plugins** → **Load unpacked plugin** → select this folder.
5. Open any graph; a folder toggle appears in the header and the file tree in the left sidebar.

### Development

```bash
npm run dev    # vite build --watch
```

Reload the plugin from the Plugins page after each rebuild.

## How it works

Logseq exposes no official API to add a section to the left sidebar. This plugin uses `logseq.provideUI({ path, template })` to inject HTML into the host document's `.left-sidebar-inner` container, and talks to Logseq's Electron IPC bridge (`window.top.apis.doAction(...)`) for filesystem operations that the public plugin API doesn't cover (readdir, mkdir, rename, unlink, copyFile, openPath, openFileInFolder).

- **Pages tree:** for file-based graphs, Markdown files follow their real folders and then split `___` filename namespaces into nested groups. DB graphs fall back to `logseq.Editor.getAllPages()` split by `/`.
- **Folder source:** `readdir` IPC against the graph root supplies both trees. Only files inside checked root folders are included; loose files at the graph root are omitted.
- **Click handlers:** `logseq.provideModel` with `data-on-click` attributes.
- **Theme-safe:** all styles use Logseq's CSS variables (`--ls-*`).

## Limitations

- The sidebar selector (`.left-sidebar-inner > .flex.flex-col.wrap`) is unofficial — a Logseq UI refactor could break rendering.
- The Date view and graph-folder filter need a file-based graph (not DB-only).
- Folder rename is not yet supported from the context menu (only file/page rename).

## License

MIT.
