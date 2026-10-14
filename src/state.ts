export type View = "name" | "date";

export interface ViewSettings {
  hideDate: boolean;
  namespaceDepth: number;
}

export interface PersistedState {
  view: View;
  panelOpen: boolean;
  nameHideDate?: boolean; nameNamespaceDepth?: number;
  dateHideDate?: boolean; dateNamespaceDepth?: number;
  dateRecentWeeks?: number;
  dateRecentHours?: number;
  rootCollapsed: boolean;
  openFolders: string[];
}

export class State {
  view: View = "name";
  viewSettings: Record<View, ViewSettings> = {
    name: { hideDate: false, namespaceDepth: 99 },
    date: { hideDate: false, namespaceDepth: 0 },
  };
  dateRecentWeeks = 1;
  dateRecentHours = 24;
  maxNamespaceDepth = 0;
  panelOpen = false;
  settingsOpen = false;
  rootCollapsed = false;
  open = new Set<string>();
  currentPage: string | null = null;
  graphName: string = "";
  dateFormat: string = "MMM do, yyyy";

  load(s: Partial<PersistedState> | undefined) {
    if (!s) return;
    if (s.view === "name" || s.view === "date") this.view = s.view;
    if (typeof s.nameHideDate === "boolean") this.viewSettings.name.hideDate = s.nameHideDate;
    if (Number.isFinite(s.nameNamespaceDepth)) this.viewSettings.name.namespaceDepth = Math.max(0, Math.floor(s.nameNamespaceDepth!));
    if (typeof s.dateHideDate === "boolean") this.viewSettings.date.hideDate = s.dateHideDate;
    if (Number.isFinite(s.dateNamespaceDepth)) this.viewSettings.date.namespaceDepth = Math.max(0, Math.floor(s.dateNamespaceDepth!));
    if (Number.isFinite(s.dateRecentWeeks)) this.dateRecentWeeks = Math.max(0, Math.floor(s.dateRecentWeeks!));
    if (Number.isFinite(s.dateRecentHours)) this.dateRecentHours = Math.max(0, Math.floor(s.dateRecentHours!));
    if (typeof s.panelOpen === "boolean") this.panelOpen = s.panelOpen;
    if (typeof s.rootCollapsed === "boolean")
      this.rootCollapsed = s.rootCollapsed;
    if (Array.isArray(s.openFolders)) this.open = new Set(s.openFolders);
  }

  dump(): PersistedState {
    return {
      view: this.view,
      panelOpen: this.panelOpen,
      nameHideDate: this.viewSettings.name.hideDate,
      nameNamespaceDepth: this.viewSettings.name.namespaceDepth,
      dateHideDate: this.viewSettings.date.hideDate,
      dateNamespaceDepth: this.viewSettings.date.namespaceDepth,
      dateRecentWeeks: this.dateRecentWeeks,
      dateRecentHours: this.dateRecentHours,
      rootCollapsed: this.rootCollapsed,
      openFolders: [...this.open],
    };
  }

  setViewSetting(view: View, key: keyof ViewSettings, value: boolean | number) {
    (this.viewSettings[view] as any)[key] = value;
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
