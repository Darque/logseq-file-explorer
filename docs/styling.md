# Styling

All CSS lives in `src/styles.css` and is injected via `logseq.provideStyle({ key: "fe-styles", style: cssText })` at `src/main.ts:68`. The CSS runs in the host page, not the iframe, so selectors reach the DOM Logseq splices in from our `provideUI` calls.

## Theme sync: use Logseq CSS vars

Never hardcode colors. Logseq exposes CSS variables on `<html>` that change when the user switches themes, and we consume them directly — the plugin follows the theme automatically with zero code:

| Variable | Used for |
|---|---|
| `--ls-primary-background-color` | fallback background |
| `--ls-secondary-background-color` | panel + context menu bg (`src/styles.css:20, 232`) |
| `--ls-tertiary-background-color` | active-row bg (`:109`) |
| `--ls-quaternary-background-color` | hover bg (`:60, 83, 106`) |
| `--ls-primary-text-color` | main text |
| `--ls-secondary-text-color` | dim labels, icons |
| `--ls-active-primary-color` | selection / drop-target accent |
| `--ls-border-color` | dividers, outlines |

Every color rule in `styles.css` has a fallback (`var(--ls-foo, #fallback)`) so the plugin still looks sane if a theme omits the variable.

## The Monaco class-name trick

We reuse Logseq's own internal list/tree class names so our rows inherit the same height, ellipsis, and hover semantics as native lists:

- `.monaco-list`, `.monaco-list-rows`, `.monaco-list-row`
- `.monaco-tl-row`, `.monaco-tl-twistie`, `.monaco-tl-indent`, `.monaco-tl-contents`

The chevron rotation uses a CSS transform (`src/styles.css:157-159`):

```css
.fe-panel .monaco-tl-twistie.expanded svg { transform: rotate(90deg); }
```

The twistie element is rendered with class `expanded` or `collapsed` (`src/render.ts:120`) and contains an inline `ICON_CHEVRON` SVG — a Tabler `chevron-right`. The rotation makes it point down when expanded.

## Obsidian-style leaf rows

No leading file-type icon on leaves. A subtle right-aligned extension label (`.fe-ext`) renders the file extension in uppercase, dim text:

```css
/* src/styles.css:184-192 */
.fe-panel .fe-ext {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  opacity: 0.45;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

Extension hidden for pages (no extension emitted in `src/render.ts:97-103` when `source !== "fs"` or ext is empty).

## Panel positioning

`.fe-panel` uses `position: absolute; inset: 0` (`src/styles.css:17-28`) with `z-index: 20`. The container (`.left-sidebar-inner > .flex.flex-col.wrap`) needs to be a positioning ancestor — `src/main.ts#ensurePanelContainerRelative` (line 51) forces `position: relative` on it if computed style is `static`. Without this the panel would escape its intended bounds.

`.fe-panel.fe-hidden { display: none }` — when `state.panelOpen` is false, `renderPanel` returns a hidden stub so the DOM slot still exists (for cleaner transition on reopen) but takes no space.

## Tab bar layout

`.fe-tabs` uses `justify-content: space-between` to push Files/Pages tabs left and the action buttons (`.fe-tab-btn`) right:

```
[ Files | Pages ]                    [ + file  + folder  ↻ ]
└── .fe-tabs-inner ──┘    └────── .fe-tabs-actions ──────┘
```

See `src/styles.css:32-85` and the markup in `src/render.ts:49-59`.

## Context menu

`.fe-ctx-menu` has `position: absolute` and `z-index: 10000` (`src/styles.css:227-240`). The extremely high z-index keeps it above Logseq's own popovers and right-sidebar. See [context-menu.md](context-menu.md) for why `absolute` (not `fixed`).

Hover highlights on menu items invert to `--ls-active-primary-color` with white text for strong visual feedback:

```css
/* src/styles.css:250-253 */
.fe-ctx-item:hover {
  background: var(--ls-active-primary-color, rgba(55,112,208,0.4));
  color: #fff;
}
```

## Drag-and-drop visuals

Two classes, set from `src/dnd.ts`:

- `.is-dragging` on source row → `opacity: 0.5` (`src/styles.css:202`)
- `.drop-target` on destination row or list → dashed accent outline + tinted background (`:203-211`)

## Scrollbar

Custom webkit scrollbar (`src/styles.css:214-224`) — narrow (10px wide), translucent thumb, transparent track. Keeps the panel visually clean and matches the vibe of Logseq's own sidebars.

## Adding new styles

1. Edit `src/styles.css`. It's imported as raw text via `import cssText from "./styles.css?raw"` (`src/main.ts:7`) — Vite inlines the file contents into the bundle.
2. Rebuild (`npm run build`) and reload the plugin in Logseq.
3. Prefer extending existing CSS vars over introducing new hardcoded colors.
