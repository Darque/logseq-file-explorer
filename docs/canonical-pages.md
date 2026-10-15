# Canonical pages

## The distinction

Logseq indexes pages **by name, not by path**. But it only treats `.md` files under `pages/` and `journals/` as pages. Every other `.md` file in the graph (e.g., `aspirations/Reading List.md`, `README.md`) is "plain markdown" — it lives in the graph directory but is NOT a Logseq page.

We call a file a **canonical page** when it is a `.md` file under `pages/` or `journals/`. For these, rename/delete must go through the `logseq.Editor.*` API. For everything else, rename/delete must go through raw filesystem IPC.

## Where the flag is set

`TreeNode.canonicalPage` is declared in `src/trees/types.ts`. It is set in `src/trees/fsTree.ts` inside `buildTree`:

```ts
const canonical = isLast && !!pn &&
  (partPath.startsWith("pages/") || partPath.startsWith("journals/"));
```

The Name tree retains this flag when it transforms filesystem leaves. Noncanonical Markdown outside `pages/` and `journals/` remains noncanonical. The API-only fallback identifies its synthetic `__page/` and `__journals/` rows separately.

## Where the flag is consumed

`src/render.ts` emits `data-canonical="1"` on canonical leaves. `src/contextMenu.ts` reads it in `extractRowData`. Branches in `menuItemsFor`:

- **Rename**:
  - Canonical page → `Editor.renamePage(old, new)`
  - Everything else (file, folder, non-canonical `.md`) → `renamePath(oldAbs, newAbs)` IPC
- **Delete**:
  - Canonical page → `Editor.deletePage(name)`
  - Everything else → `unlinkPath(repoDir, absPath)` IPC

## The ghost-file bug — worked example

Before we had the canonical check, deleting a non-canonical `.md` page went through `Editor.deletePage`:

```
graph/
  aspirations/
    Reading List.md      ← a .md with first-class content but NOT under pages/
```

Calling `Editor.deletePage("Reading List")` did this:

1. Logseq looked up the page by name, found `aspirations/Reading List.md`, and unlinked it.
2. Logseq then "re-created" the page at its default location — `pages/Reading List.md` — as an empty stub.

Result: the user thought they deleted one file; they actually lost their original AND created a ghost at the graph root. This is because `deletePage` is spec'd around canonical pages; the re-create step assumes the page "should" live under `pages/`.

The fix is the canonical flag. After the fix:

```ts
if (isPage && data.page && data.canonical) {
  await Editor.deletePage(data.page);        // canonical: safe
} else {
  await unlinkPath(graph.path, abs);         // non-canonical: raw unlink, no ghost
}
```

The same reasoning applies to rename: `Editor.renamePage` for a non-canonical file would relocate it to `pages/`, which is not what the user wants.

## Data flow summary

```
buildFsTree()
   ↓ sets canonicalPage on TreeNode
render.ts renders:
   <div class="fe-row" data-canonical="1" ...>
   ↓
contextMenu.ts extractRowData() reads data-canonical
   ↓
menuItemsFor() branches on data.canonical for Rename + Delete
```

## When adding a new action

If you add any menu item that conceptually mutates a page identity (rename, delete, move between `pages/` and elsewhere, archive), ask: **does this file live under `pages/` or `journals/`?**

- Yes → use `logseq.Editor.*`.
- No → use raw fs IPC via `src/fsOps.ts`.

Duplicate and Move in `src/contextMenu.ts` use filesystem operations. Treat those actions carefully for canonical pages because Logseq's database and links may need reconciliation after a path change.
