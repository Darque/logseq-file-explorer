export type View = "pages" | "fs";

export interface PersistedState {
  view: View;
  panelOpen: boolean;
  rootCollapsed: boolean;
  openFolders: string[];
}

export class State {
  view: View = "fs";
  panelOpen = false;
  rootCollapsed = false;
  open = new Set<string>();
  currentPage: string | null = null;
  graphName: string = "";
  dateFormat: string = "MMM do, yyyy";

  load(s: Partial<PersistedState> | undefined) {
    if (!s) return;
    if (s.view === "pages" || s.view === "fs") this.view = s.view;
    if (typeof s.panelOpen === "boolean") this.panelOpen = s.panelOpen;
    if (typeof s.rootCollapsed === "boolean")
      this.rootCollapsed = s.rootCollapsed;
    if (Array.isArray(s.openFolders)) this.open = new Set(s.openFolders);
  }

  dump(): PersistedState {
    return {
      view: this.view,
      panelOpen: this.panelOpen,
      rootCollapsed: this.rootCollapsed,
      openFolders: [...this.open],
    };
  }

  toggleFolder(path: string) {
    if (this.open.has(path)) this.open.delete(path);
    else this.open.add(path);
  }

  isOpen(path: string) {
    return this.open.has(path);
  }
}

export const state = new State();
