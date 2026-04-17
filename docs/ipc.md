# IPC — Logseq's Electron bridge

All filesystem work funnels through `window.top.apis.doAction([handler, ...args])`. Handlers are defined in Clojure at `/tmp/logseq/src/electron/electron/handler.cljs`. **Read this file before touching `src/fsOps.ts`.**

## The critical gotcha: errors-as-values

Several Clojure handlers wrap their work in `try/catch` and **return the error object (or `nil`) as a resolved promise value**. That means:

```ts
try {
  await apis.doAction(["unlink", repo, abs]); // returns nil on failure
  // we get here even on failure!
} catch (e) {
  // never fires for unlink/writeFile/copyFile failures
}
```

This is why `src/fsOps.ts:36-45` defines `isIpcError(r)` — a shape sniffer that checks for a returned `{ message, code?, errno?, stack? }` object. Every IPC call in `fsOps.ts` runs the result through this check and ALSO checks `r == null` / `r === undefined` for the handlers that just return `nil`.

**The rule**: if you add a new IPC call, assume the handler swallows exceptions. Inspect the Clojure source in `handler.cljs` and match the response-shape check to what it actually returns.

## Per-handler behavior (verified against handler.cljs)

| Handler | Args | Success | Failure | Our check |
|---|---|---|---|---|
| `readdir` | `[absPath]` | array of strings or `[{path, isDirectory}]` | throws | `src/trees/fsTree.ts:44-51` normalizer tolerates both shapes |
| `stat` | `[absPath]` | stat object | (we don't rely on it) | `src/fsOps.ts:67` |
| `rename` | `[from, to]` | `undefined` | **throws** | `src/fsOps.ts:77-96` — try/catch catches |
| `unlink` | `[repoDir, absPath]` | `undefined` | returns `nil` (caught in Clojure, pops a Logseq notification) | `src/fsOps.ts:111` — explicit `if (r === null)` |
| `writeFile` | `[repo, path, content]` | stat object (truthy) | returns `nil` (caught in Clojure) | `src/fsOps.ts:151` — treats null/undefined as failure |
| `copyFile` | `[repo, from, to]` | eventually truthy | unreliable — see below | `src/fsOps.ts:164` — best-effort |
| `mkdir-recur` | `[absPath]` | `undefined` | throws | `src/fsOps.ts:189` |
| `openFileInFolder` | `[absPath]` | reveals in Finder (`shell.showItemInFolder`) | — | `src/fsOps.ts:210` |
| `openPath` | `[absPath]` | opens in default app (`shell.openPath`) | — | `src/contextMenu.ts:309` |
| `openNewWindow` | `[graphPath]` | — | — | `src/contextMenu.ts:241`. **Takes the graph path, not the graph name.** |

`apis.copyToClipboard(text)` is a **direct** API method (not routed through `doAction`). Preferred over `navigator.clipboard.writeText` which is unreliable in a plugin iframe and can reject on focus rules. See the clipboard fallback chain in `src/contextMenu.ts:416-453` (apis → navigator → textarea `execCommand`).

## copyFile is particularly fragile

The `copyFile` handler in `handler.cljs` uses `fs-extra/copy`, which returns a promise, but the handler does **not** `await` it. Our `isIpcError` check can't reliably detect failure because by the time we see the response, the async copy hasn't settled. In practice the copy usually works, but don't trust the boolean return from `src/fsOps.ts#copyFile` for anything critical — always re-read the tree after and visually confirm.

## Error plumbing: `lastError`

`src/fsOps.ts:8` maintains a module-level `lastError: string`. Each op writes to it on failure; `getLastFsError()` (line 10) reads and **clears** it (one-shot consumption). UI call sites use it to show real error text in toasts:

```ts
// src/contextMenu.ts:278
toast(`Move failed: ${getLastFsError() || "unknown error"}`, "warning");
```

Because `getLastFsError()` clears on read, call it **once** per error and stash the result if you need it twice.

## getApis: graceful degradation

`src/fsOps.ts#getApis` (line 16) tries `window.top.apis` then `window.apis` then returns `null`. A `null` return means no IPC — the Files view will show `"Filesystem API unavailable in this Logseq build."` (see `src/trees/fsTree.ts:27`), and Pages view continues to work because it uses `Editor.getAllPages`.

## When adding a new IPC call

1. Open `/tmp/logseq/src/electron/electron/handler.cljs` and find the handler.
2. Trace its return / catch behavior. Does it throw, return `nil`, or return the error object?
3. In `fsOps.ts`, wrap it using the same pattern as `unlinkPath` (three checks: `isIpcError`, null/undefined, catch).
4. Set `lastError` on every failure path.
5. Return `boolean` (or a narrow result type) — never leak the raw IPC response to callers.
