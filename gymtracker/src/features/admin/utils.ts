export function normalizeAdminText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeAdminSearch(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function getReferenceMonthFromInput(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value.slice(0, 7)}-01`;
  }

  throw new Error("Reference month must be YYYY-MM");
}

export function getCurrentReferenceMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function getEndOfMonthISO(referenceMonthISO: string) {
  const [year, month] = referenceMonthISO.split("-").map(Number);
  const endOfMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  return endOfMonth.toISOString().slice(0, 10);
}

export function getEndOfPreviousMonthISO(referenceMonthISO: string) {
  const [year, month] = referenceMonthISO.split("-").map(Number);
  const endOfPreviousMonth = new Date(Date.UTC(year, month - 1, 0, 12, 0, 0));
  return endOfPreviousMonth.toISOString().slice(0, 10);
}

export function maxDateISO(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export function addDaysToISO(dateISO: string, days: number) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
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
