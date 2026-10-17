const MAX_AMOUNT = 9_999_999;

export function applyAmountKey(current: number, key: string): number {
  if (key === "clear") return 0;
  if (key === "back") return Math.floor(current / 10);
  if (key === "000") return Math.min(current * 1000, MAX_AMOUNT);
  if (!/^\d$/.test(key)) return current;
  const next = current * 10 + Number(key);
  return next > MAX_AMOUNT ? current : next;
}
