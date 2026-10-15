# Trees and sorting

Both views use `TreeNode[]` from `src/trees/types.ts` and the selected root graph folders from `src/trees/fsTree.ts`.

## Filesystem scan and root selection

`buildFsTree()` asks Logseq's Electron `readdir` IPC for graph paths, normalizes returned strings or path objects, discovers root folders, and builds a physical tree from files in selected roots. Loose files at the graph root are omitted. Root folder choices are stored per graph in `State.folderSelections`; `logseq`, `.git`, `.obsidian`, and `node_modules` start unchecked. The scan runs on tree refresh, so newly added root folders appear in settings.

`fileToPage()` maps canonical `pages/*.md` and `journals/*.md` filenames to Logseq page names. Journals use the configured preferred date format. Other Markdown files retain a derived page name where useful, but `canonicalPage` is false so context-menu rename and delete use filesystem operations.

## Name view

`pagesFromFiles()` keeps Markdown leaves and physical folders, then splits `___` filename namespaces. `namespaceParts()` limits the number of parent namespace folders. At depth `0`, the namespace path appears in the leaf label. At depth `1`, extra namespace components share the first parent label, such as `Note/Guidance`; the leaf is `Quick Start`.

When filesystem IPC is unavailable, `pagesFromApi()` builds a page-name tree from `Editor.getAllPages()` using `/` namespace separators. It has no physical-folder data.

## Date view

`addModifiedTimes()` fetches and caches filesystem times; Name requests visible leaves, while Date requests all selected files so it can sort them. Refresh, graph changes, and DB changes clear the cache.

`dateTree()` flattens physical folders. Files newer than the hour cutoff go into local `dd/mm/yy hh:00` folders. Other files within the week window use `dd/mm/yy` folders. Earlier files go into `Older files`. The cutoffs are recalculated on tree load or refresh. Namespace grouping remains optional inside each date folder.

Date folders sort newest first. Within folders, `contents` sorts first, then names beginning with `_`; other file leaves are ordered by modification time. The visible timestamp is formatted in local system time as `dd/mm/yy hh:mm`.

## Rendering

`src/render.ts` turns leaves into page or file rows, adds the timestamp column when enabled, and highlights the current page or its highest visible collapsed parent. A tooltip is populated only when a file label overflows. Physical, noncanonical rows are marked as filesystem sources; virtual namespace and date folders are not valid drag-and-drop destinations.
