export const ALL_DEPTH = 99;

export function parseNamespaceDepth(value: string, maxDepth: number): number {
  const raw = value.trim();
  if (!/^-?\d+$/.test(raw)) return ALL_DEPTH;
  const depth = Number(raw);
  if (!Number.isSafeInteger(depth) || depth > maxDepth) return ALL_DEPTH;
  return Math.max(0, depth);
}

export function parseNonnegativeCount(value: string, fallback: number): number {
  const raw = value.trim();
  if (!/^-?\d+$/.test(raw)) return fallback;
  const count = Number(raw);
  if (!Number.isSafeInteger(count)) return fallback;
  return Math.max(0, count);
}
