// Thin wrapper around Logseq's Electron IPC, available at window.top.apis.doAction.
// Returns null if the API isn't available (e.g. browser/DB-only builds) so callers can degrade.

type ApisBridge = {
  doAction: (args: any[]) => Promise<any>;
};

let lastError = "";

export function getLastFsError(): string {
  const e = lastError;
  lastError = "";
  return e;
}

export function getApis(): ApisBridge | null {
  try {
    const top = (window as any).top;
    if (top && top.apis && typeof top.apis.doAction === "function") {
      return top.apis;
    }
  } catch {
    /* cross-origin — no-op */
  }
  try {
    const w = window as any;
    if (w.apis && typeof w.apis.doAction === "function") {
      return w.apis;
    }
  } catch {
    /* noop */
  }
  return null;
}

function isIpcError(r: any): boolean {
  if (r == null) return false;
  if (r instanceof Error) return true;
  if (typeof r !== "object") return false;
  return (
    typeof r.message === "string" &&
    (typeof r.code === "string" || typeof r.errno === "number" ||
      typeof r.stack === "string" || /Error:/.test(r.message))
  );
}

function ipcErrorMessage(r: any): string {
  if (r instanceof Error) return r.message;
  if (r && typeof r === "object") {
    if (typeof r.message === "string") return r.message;
    return JSON.stringify(r);
  }
  return String(r);
}

export async function readdir(absPath: string): Promise<any | null> {
  const apis = getApis();
  if (!apis) return null;
  try {
    return await apis.doAction(["readdir", absPath]);
  } catch (e) {
    console.error("[file-explorer] readdir failed:", e);
    return null;
  }
}

export async function stat(absPath: string): Promise<any | null> {
  const apis = getApis();
  if (!apis) return null;
  try {
    return await apis.doAction(["stat", absPath]);
  } catch {
    return null;
  }
}

export async function renamePath(from: string, to: string): Promise<boolean> {
  const apis = getApis();
  if (!apis) {
    lastError = "Filesystem API unavailable";
    return false;
  }
  try {
    const r = await apis.doAction(["rename", from, to]);
    if (isIpcError(r)) {
      lastError = ipcErrorMessage(r);
      console.error("[file-explorer] rename ipc error:", from, "->", to, r);
      return false;
    }
    return true;
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.error("[file-explorer] rename failed:", from, "->", to, e);
    return false;
  }
}

export async function unlinkPath(repoDir: string, absPath: string): Promise<boolean> {
  const apis = getApis();
  if (!apis) {
    lastError = "Filesystem API unavailable";
    return false;
  }
  try {
    const r = await apis.doAction(["unlink", repoDir, absPath]);
    if (isIpcError(r)) {
      lastError = ipcErrorMessage(r);
      console.error("[file-explorer] unlink ipc error:", absPath, r);
      return false;
    }
    if (r === null) {
      lastError = "Unlink failed (check Logseq notifications)";
      console.error("[file-explorer] unlink returned null:", absPath);
      return false;
    }
    return true;
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.error("[file-explorer] unlink failed:", e);
    return false;
  }
}

export async function readFileRaw(absPath: string): Promise<string | null> {
  const apis = getApis();
  if (!apis) return null;
  try {
    return await apis.doAction(["readFile", absPath]);
  } catch {
    return null;
  }
}

export async function writeFile(
  repo: string,
  absPath: string,
  content: string,
): Promise<boolean> {
  const apis = getApis();
  if (!apis) {
    lastError = "Filesystem API unavailable";
    return false;
  }
  try {
    const r = await apis.doAction(["writeFile", repo, absPath, content]);
    if (isIpcError(r)) {
      lastError = ipcErrorMessage(r);
      console.error("[file-explorer] writeFile ipc error:", absPath, r);
      return false;
    }
    if (r === null || r === undefined) {
      lastError = "Write failed (check Logseq notifications)";
      console.error("[file-explorer] writeFile returned empty:", absPath);
      return false;
    }
    return true;
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.error("[file-explorer] writeFile failed:", e);
    return false;
  }
}

export async function copyFile(
  repo: string,
  from: string,
  to: string,
): Promise<boolean> {
  const apis = getApis();
  if (!apis) {
    lastError = "Filesystem API unavailable";
    return false;
  }
  try {
    const r = await apis.doAction(["copyFile", repo, from, to]);
    if (isIpcError(r)) {
      lastError = ipcErrorMessage(r);
      console.error("[file-explorer] copyFile ipc error:", from, "->", to, r);
      return false;
    }
    return true;
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.error("[file-explorer] copyFile failed:", e);
    return false;
  }
}

export async function mkdir(absPath: string, recursive = true): Promise<boolean> {
  const apis = getApis();
  if (!apis) {
    lastError = "Filesystem API unavailable";
    return false;
  }
  try {
    const r = await apis.doAction([recursive ? "mkdir-recur" : "mkdir", absPath]);
    if (isIpcError(r)) {
      lastError = ipcErrorMessage(r);
      console.error("[file-explorer] mkdir ipc error:", absPath, r);
      return false;
    }
    return true;
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.error("[file-explorer] mkdir failed:", absPath, e);
    return false;
  }
}

export async function revealInFinder(absPath: string): Promise<void> {
  const apis = getApis();
  if (!apis) return;
  try {
    await apis.doAction(["openFileInFolder", absPath]);
  } catch (e) {
    console.error("[file-explorer] reveal failed:", e);
  }
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

export function basename(p: string): string {
  return p.replace(/\/+$/, "").split("/").pop() || "";
}

export function dirname(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx < 0 ? "" : trimmed.slice(0, idx);
}

export function extname(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : "";
}
