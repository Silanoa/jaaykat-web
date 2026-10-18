const NBSP = "\u00A0";
const THIN_NBSP = "\u202F";

const WEEKDAY_FR: Record<string, string> = {
  Sun: "dim.",
  Mon: "lun.",
  Tue: "mar.",
  Wed: "mer.",
  Thu: "jeu.",
  Fri: "ven.",
  Sat: "sam.",
};

const MONTHS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function groupDigits(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(value).toString();
  const parts: string[] = [];
  for (let index = digits.length; index > 0; index -= 3) {
    parts.unshift(digits.slice(Math.max(0, index - 3), index));
  }
  return sign + parts.join(THIN_NBSP);
}

export function formatXof(amount: number): string {
  return `${groupDigits(Math.round(amount))}${NBSP}F`;
}

export function formatSats(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return "0 sats";
  return `${groupDigits(rounded)} sats`;
}

type DakarParts = {
  weekday: string;
  day: number;
  month: number;
  hour: string;
  minute: string;
};

function dakarParts(iso: string): DakarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dakar",
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: WEEKDAY_FR[read("weekday")] ?? read("weekday"),
    day: Number(read("day")),
    month: Number(read("month")),
    hour: read("hour").padStart(2, "0"),
    minute: read("minute").padStart(2, "0"),
  };
}

export function formatClock(iso: string): string {
  const parts = dakarParts(iso);
  return `${parts.hour}:${parts.minute}`;
}

export function formatWhen(iso: string): string {
  const parts = dakarParts(iso);
  const month = MONTHS_FR[parts.month - 1] ?? "";
  return `${parts.weekday} ${parts.day} ${month}, ${parts.hour}:${parts.minute}`;
}

export function formatDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${day} ${MONTHS_FR[(month ?? 1) - 1] ?? ""} ${year}`;
}

export function formatDate(iso: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return formatDay(date);
}

export function countdown(expiresAt: string, nowMs: number): {
  mmss: string;
  expired: boolean;
  urgent: boolean;
  expiresClock: string;
} {
  const expiresClock = formatClock(expiresAt);
  const remaining = Date.parse(expiresAt) - nowMs;
  if (remaining <= 0) {
    return { mmss: "00:00", expired: true, urgent: false, expiresClock };
  }
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    mmss: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    expired: false,
    urgent: remaining < 60_000,
    expiresClock,
  };
}
