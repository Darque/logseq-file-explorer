# Build & load

## Dev loop

```bash
npm install
npm run build     # one-shot build → dist/
npm run dev       # watch mode (vite build --watch)
```

See `package.json:6-9`. The bundle entry is declared via the plugin manifest:

```json
// package.json:5, 17-21
"main": "dist/index.html",
"logseq": {
  "id": "logseq-file-explorer",
  "title": "File Explorer",
  "icon": "./icon.svg"
}
```

Logseq reads this manifest to register the plugin. Any change to the manifest requires reloading the plugin in Logseq.

## Loading into Logseq

1. Logseq → Settings → Advanced → enable **Developer mode**.
2. Open Plugins → **Load unpacked plugin** → pick the repo root (`logseq-file-explorer/`, not `dist/`).
3. After each `npm run build`, go back to Plugins and click the reload icon next to File Explorer. Watch mode (`npm run dev`) rebuilds on save, but Logseq still needs a manual reload to pick up the new `dist/`.

## Build output

Vite produces `dist/index.html` plus the bundled JS/CSS. Nothing else in `dist/` is intended to be edited by hand. The `src/styles.css?raw` import (`src/main.ts:7`) causes Vite to inline the raw text of `styles.css` into the JS bundle; the CSS is then injected via `logseq.provideStyle` at startup.

## Debugging

- Open **View → Toggle Developer Tools** in Logseq. The plugin runs in an iframe; use the iframe context dropdown to target it, or use `window.top` from the top frame to interact with host DOM.
- The plugin logs errors to the console with a `[file-explorer]` prefix — see `src/fsOps.ts`, `src/contextMenu.ts`, `src/dnd.ts`. Failures that were swallowed by Logseq's IPC surface here.
- Toasts (`logseq.UI.showMsg`) surface user-visible errors with the real message from `getLastFsError()`.

## Reference

Logseq source is checked out read-only at `/tmp/logseq/` for reference. **Do not edit it** — it's a system reference tree. Key files when extending the plugin:

| Path | Purpose |
|---|---|
| `/tmp/logseq/src/electron/electron/handler.cljs` | IPC handlers. Read this before adding any new `doAction` call. See [ipc.md](ipc.md). |
| `/tmp/logseq/libs/src/LSPlugin.user.ts` | Public plugin API surface (`logseq.App`, `logseq.Editor`, `logseq.UI`, etc.) |
| `/tmp/logseq/libs/src/LSPlugin.core.ts` | Core plugin runtime — `provideUI`, `provideModel`, `provideStyle` implementations |
| `/tmp/logseq/libs/src/LSPlugin.shadow.ts` | Shadow DOM / iframe bridging |
| `/tmp/logseq/src/main/frontend/` | Native UI code (ClojureScript) — useful for finding the selectors we mount against |

When hunting for a method's actual behavior, the `.cljs` side is authoritative — the TS type definitions in `libs/src/` are often thinner than the real contract.

## CI / publish

No CI or publish step is configured. The plugin is loaded unpacked during development. To publish to the Logseq marketplace: follow the [Logseq Plugin Marketplace guide](https://github.com/logseq/marketplace) — requires creating a `packages.json` entry in the marketplace repo and pinning a GitHub release artifact.
