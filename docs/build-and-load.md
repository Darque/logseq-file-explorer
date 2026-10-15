# Build and load

See the [main README](../README.md) for installation and the alpha-stage warning.

The maintained checkout is `/Users/phil/ai/logseq-file-explorer`. Use its [`fixtures/demo-graph`](../fixtures/demo-graph/README.md) for visual checks and screenshot updates. The installed copy under `~/.logseq/plugins/logseq-file-explorer` is a deployment copy, not the source checkout.

If Logseq is still using that installed copy, a source build alone does not update it. After building in this checkout, copy `dist/index.html`, `dist/assets/`, `package.json`, `icon.svg`, and `README.md` into `~/.logseq/plugins/logseq-file-explorer/`, then reload the plugin. Keep all source edits in this checkout.

```sh
npm install
npm run build       # one-shot Vite build into dist/
npm run dev         # watch mode; Logseq still needs a reload
```

The plugin manifest in `package.json` points Logseq to `dist/index.html`. Load the repository root as an unpacked plugin in Logseq Desktop with Developer mode enabled. After a rebuild, reload the plugin from the Plugins page or use **View → Reload**. Do not edit generated `dist/` files by hand.

The plugin runs in an iframe. **View → Toggle Developer Tools** can inspect the host and plugin contexts. Source errors use a `[file-explorer]` prefix; filesystem failures can also appear as Logseq toasts. IPC behavior is documented in [ipc.md](ipc.md).

There is no automated publish pipeline, marketplace package, or compatibility guarantee. This repository is a personal-use alpha fork.
