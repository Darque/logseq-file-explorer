# File Explorer screenshot graph

This dedicated Logseq graph contains generic sample pages and folders used to check the Name and Date views and capture the screenshots in `../../docs/`. Open this directory as a graph in Logseq Desktop. The `.git` pointer created by Logseq's internal versioning is intentionally excluded from the repository. A copy of its old temporary-location version history is retained locally at `../../.local/demo-graph-logseq-history/`; Logseq may create new history when the graph is opened at this path.

The Date view uses filesystem modification times, which Git does not preserve. Before checking recent-hour grouping, run this from the repository root:

```sh
node scripts/refresh-demo-dates.mjs
```

That command changes timestamps only on the fixture's Markdown files. Refresh the explorer tree in Logseq afterward. It does not change file content or a personal graph.
