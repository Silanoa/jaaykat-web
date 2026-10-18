export type RangeKey = "today" | "7d" | "30d";

export function rangeBounds(key: RangeKey, now = new Date()): { from: string; to: string } {
  const start = dakarDayStart(now);
  if (key === "7d") start.setUTCDate(start.getUTCDate() - 6);
  if (key === "30d") start.setUTCDate(start.getUTCDate() - 29);
  const end = dakarDayStart(now);
  end.setUTCHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function dakarDayStart(now: Date): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${iso}T00:00:00.000Z`);
}
