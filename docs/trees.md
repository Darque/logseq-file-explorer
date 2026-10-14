# Trees

Two separate tree builders, both producing `TreeNode[]` (`src/trees/types.ts:1-8`).

## Pages tree — `src/trees/pagesTree.ts`

For file-based graphs, Pages starts with the Files tree and keeps Markdown files. Real graph directories stay as folders. Within each directory, a filename such as `Note___Research___Example.md` becomes `Note → Research → Example`; its file path remains attached to the leaf. Markdown outside Logseq's canonical `pages/` and `journals/` folders opens as a file rather than creating a page with a guessed name. Synthetic namespace folders have stable expansion state and no file-operations context menu.

When the filesystem API is unavailable, Pages falls back to `logseq.Editor.getAllPages()` and groups page names by `/`. The fallback has no physical-folder information.

- Journal files stay in their physical `journals` folder. In the API fallback, journal pages use a synthetic `journals` root.
- In the API fallback, pages whose name starts with `$` are skipped; these are internal Logseq system pages.

Sort order: folders before leaves; within a level, `localeCompare` alphabetical. In the API fallback, journals are sorted descending and placed first.

## Files tree — `src/trees/fsTree.ts`

Source: `readdir(graph.path)` IPC. `readdir` in Logseq is **recursive** — it returns all paths under the graph root in one call. We normalize in `normalizeReaddir` (line 44-51) because the IPC has returned both `string[]` and `{path, isDirectory}[]` shapes in different Logseq versions.

### Ignored paths

`src/trees/fsTree.ts:5` — hardcoded set:

```ts
const IGNORED = new Set([".git", "node_modules", ".DS_Store", ".obsidian", "logseq"]);
```

Plus anything whose last path component starts with `.` (line 63). `logseq` is ignored because its contents are config/backups, not user content.

To add an ignored path, extend the `IGNORED` set. Folders with spaces or special characters work fine — this is a `Set<string>` lookup against each path component via `parts.some(p => IGNORED.has(p))`.

### Tree build

`buildTree` (line 70-100) splits each relative path by `/`, walks into the nested structure, and creates `TreeNode` entries. The `canonicalPage` flag is set here — see [canonical-pages.md](canonical-pages.md).

Sort (line 119-126): folders first, then `localeCompare`, recursively.

## Journal date formatting

Journal filenames are normalized to pretty dates via `fileToPage()` (line 102-117):

```ts
if (base.startsWith("journals/")) {
  const name = base.slice(9);
  const m = name.match(/^(\d{4})[_-](\d{2})[_-](\d{2})$/);
  if (m) {
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return formatDate(date, state.dateFormat);
  }
  return name;
}
```

- Matches BOTH legacy `YYYY_MM_DD.md` and current `YYYY-MM-DD.md` filename formats. LogSeq vaults commonly mix both — don't normalize filenames.
- Format string comes from `state.dateFormat`, loaded at startup from `App.getUserConfigs().preferredDateFormat` (`src/main.ts:73-77`). Default is `"MMM do, yyyy"` (`src/state.ts:17`).
- `formatDate` (line 149-169) supports: `EEEE` (full weekday), `EEE` (short weekday), `MMMM`, `MMM`, `MM`, `yyyy`, `yy`, `do` (ordinal day), `dd`, `d`.

The `\bd\b` boundary on the `d` token matters (line 164) — without it, `d` would match inside `do`/`dd`/weekday tokens.

## File-to-page mapping

`fileToPage` (line 102) determines whether a leaf is a Logseq page:

- `pages/Foo.md` → page name `Foo`, with `___` → `/` (the LogSeq namespace escape)
- `pages/Foo___Bar.md` → `Foo/Bar`
- `journals/2026-04-17.md` → formatted per `state.dateFormat`
- `aspirations/Reading List.md` → `Reading List` (page name derived) **but** `canonicalPage` stays `false` so rename/delete route to raw fs ops
- Non-`.md` files → `pageName` is `undefined`, treated as a plain file

The distinction between "has `pageName`" and "`canonicalPage === true`" is subtle but load-bearing — see [canonical-pages.md](canonical-pages.md).

## Rendering derived from tree

`src/render.ts#renderRow` (line 78) reads the TreeNode and decides:

- Leaf with `pageName` → clickable row routed through `openPage` in the model.
- Leaf without `pageName` → routed through `openFile` (which reveals in Finder — `src/main.ts:115-124`).
- Non-leaf → folder, click toggles `state.open` via `toggleFolder`.

The `fe-ext` label (`src/render.ts:97-103`) is the obsidian-style dim extension suffix — only shown when `source === "fs"` AND the file has an extension. Pages never show an extension.
