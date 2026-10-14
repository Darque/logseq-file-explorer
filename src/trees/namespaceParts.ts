/** Keep the selected number of folder levels, folding extra namespaces into the last folder. */
export function namespaceParts(parts: string[], depth: number): string[] {
  const folders = Math.min(Math.max(0, Math.floor(depth)), Math.max(0, parts.length - 1));
  if (folders === 0) return [parts.join("/")];
  return [
    ...parts.slice(0, folders - 1),
    parts.slice(folders - 1, -1).join("/"),
    parts[parts.length - 1],
  ];
}
