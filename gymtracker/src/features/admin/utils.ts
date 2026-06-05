import { assertIsoDate } from "@/lib/validation";

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

export function normalizeAdminText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeAdminSearch(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function getReferenceMonthFromInput(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const referenceMonth = `${value}-01`;
    assertIsoDate(referenceMonth, "Reference month");
    return referenceMonth;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    assertIsoDate(value, "Reference month");
    return `${value.slice(0, 7)}-01`;
  }

  throw new Error("Reference month must be YYYY-MM");
}

function getDatePartsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function formatISODateParts(input: { year: number; month: number; day: number }) {
  return `${String(input.year).padStart(4, "0")}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")}`;
}

function formatUTCDate(date: Date) {
  return formatISODateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function getCurrentReferenceMonth(
  date = new Date(),
  timezone = APP_TIMEZONE,
) {
  const parts = getDatePartsInTimezone(date, timezone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-01`;
}

export function getEndOfMonthISO(referenceMonthISO: string) {
  assertIsoDate(referenceMonthISO, "Reference month");
  const [year, month] = referenceMonthISO.split("-").map(Number);
  const endOfMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  return formatUTCDate(endOfMonth);
}

export function getEndOfPreviousMonthISO(referenceMonthISO: string) {
  assertIsoDate(referenceMonthISO, "Reference month");
  const [year, month] = referenceMonthISO.split("-").map(Number);
  const endOfPreviousMonth = new Date(Date.UTC(year, month - 1, 0, 12, 0, 0));
  return formatUTCDate(endOfPreviousMonth);
}

export function maxDateISO(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export function addDaysToISO(dateISO: string, days: number) {
  assertIsoDate(dateISO, "Date");
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUTCDate(date);
}

export function getAdminTodayISODate(
  date = new Date(),
  timezone = APP_TIMEZONE,
) {
  return formatISODateParts(getDatePartsInTimezone(date, timezone));
}

export function slugifySystemExerciseKey(input: {
  name: string;
  modality?: string | null;
}) {
  const raw = [input.name, input.modality]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return raw || "exercise";
}
