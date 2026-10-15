# Styling

`src/styles.css` is imported as raw text and injected into Logseq's host page with `logseq.provideStyle`. The plugin uses Logseq's `--ls-*` CSS variables for panel backgrounds, borders, text, hover, selection, and drag feedback. CSS variables have fallbacks for themes that omit them.

The panel reuses Logseq's `monaco-list` and `monaco-tl-*` class names for tree rows. Chevron rotation shows expanded folders. The left sidebar container is made a positioning ancestor by `ensurePanelContainerRelative()` so `.fe-panel { position: absolute; inset: 0 }` stays in the sidebar.

The tab bar holds **Name**, **Date**, New file, New folder, Refresh, and Settings. Leaf labels use ellipsis; the timestamp occupies a right-aligned column. Noncanonical filesystem leaves can display a dim extension suffix. A tooltip appears only when the label overflows.

`src/contextMenu.ts` appends menus to the host body. `.fe-ctx-menu` uses absolute positioning and a high stacking level so submenus avoid sidebar clipping. Drag state uses `.is-dragging` and `.drop-target` styles. The list scrollbar is narrow and translucent.

After changing CSS, rebuild and reload the plugin in Logseq.
