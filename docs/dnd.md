# Drag and drop

`src/dnd.ts` registers drag listeners on the host document because rows are rendered by Logseq outside the plugin iframe. The custom MIME type `application/x-fe-path` limits target highlighting to drags started inside the explorer.

`src/render.ts` marks physical, noncanonical rows as `data-source="fs"`. Canonical Logseq pages and virtual namespace/date folders have `data-source="page"`. Drag start rejects page-source rows, and drop target resolution rejects virtual or canonical targets. Drag-to-move is therefore limited to physical, noncanonical items. The context menu remains the alternative for other actions.

Dropping on a physical folder moves the source into it. Dropping on a physical file row targets that file's parent folder. Empty list space targets the graph root. Self drops, descendant drops, and moves into the source's current parent are rejected. The move uses `renamePath()` and then rerenders the tree; failures show `getLastFsError()` in a toast.

This path-level move does not update Logseq page references. Avoid moving canonical page files directly; they are intentionally blocked at drag start.
