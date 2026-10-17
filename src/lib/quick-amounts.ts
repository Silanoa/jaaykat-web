const KEY = "jk.quickAmounts";
const DEFAULTS = [500, 1000, 2500, 5000];

export function readQuickAmounts(storage: Storage = localStorage): number[] {
  const raw = storage.getItem(KEY);
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 4) return DEFAULTS;
    if (!parsed.every((value) => Number.isInteger(value) && Number(value) > 0)) return DEFAULTS;
    return parsed as number[];
  } catch {
    return DEFAULTS;
  }
}

export function writeQuickAmounts(values: number[], storage: Storage = localStorage): void {
  storage.setItem(KEY, JSON.stringify(values));
}
