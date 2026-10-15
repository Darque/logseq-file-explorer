---
name: logseq-file-explorer
description: Maintain the standalone personal-use Logseq File Explorer plugin, its demo graph, and its documentation in this repository.
---

# Logseq File Explorer maintenance

Work from `/Users/phil/ai/logseq-file-explorer`. This is an alpha-stage, vibe-coded plugin for Phil's personal use. Keep changes and evidence out of the unrelated SecondLife project.

Read `README.md` for the user-visible behavior and `docs/README.md` for the implementation map. In particular, read `docs/ipc.md` before filesystem operations and `docs/canonical-pages.md` before rename/delete changes. Logseq Desktop's private sidebar and Electron interfaces may change.

Use `fixtures/demo-graph/` for visual checks and screenshots; it contains generic sample pages. The screenshots in `docs/` were captured from this graph. Reopen or refresh the fixture in Logseq before replacing images, and inspect screenshots for private content. Do not test destructive file operations on a personal graph.

Run `npm ci` when dependencies are missing, `npm run build`, `./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters`, and `git diff --check` for code changes. Visually check affected behavior in Logseq for UI changes and report any interaction that remains unverified. Generated `dist/` and `node_modules/` are local build artifacts, not source commits. The installed copy under `~/.logseq/plugins/logseq-file-explorer` does not update from a source build alone; see `docs/build-and-load.md` before live checks.

The only configured remote should be Phil's `origin`. Preserve upstream credit in documentation, but never push to the original upstream. Treat tags and publication separately from an ordinary source commit.
