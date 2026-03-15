export function getDayOfWeek(date: Date = new Date()): number {
  return date.getDay();
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalizedWeekdayNames(
  locale: string,
  format: "long" | "short" = "long",
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: format,
    timeZone: "UTC",
  });
  const firstSunday = new Date(Date.UTC(2024, 0, 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstSunday);
    date.setUTCDate(firstSunday.getUTCDate() + index);
    return formatter.format(date);
  });
}

export function formatMonthYear(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function cn(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Returns the current date and day-of-week resolved in the given IANA timezone.
 *
 * WHY THIS EXISTS:
 * Vercel (and most Node.js cloud runtimes) execute in UTC. Calling `new Date()`
 * on the server returns the UTC instant, so between 21:00–23:59 UTC-3 the server
 * computes tomorrow's date for a user in America/Sao_Paulo.
 * This function uses `Intl.DateTimeFormat` — available natively in Node.js 13+ —
 * to resolve the *calendar date* in an arbitrary IANA timezone without any
 * third-party library.
 *
 * @param timezone  IANA timezone string, e.g. "America/Sao_Paulo"
 * @returns { dateISO: "YYYY-MM-DD", dayOfWeek: 0–6 (Sunday = 0) }
 */
export function getTodayInTimezone(timezone: string): {
  dateISO: string;
  dayOfWeek: number;
} {
  const now = new Date();

  // 'en-CA' locale always emits the date as YYYY-MM-DD, making it safe to
  // use directly as an ISO date string without any string manipulation.
  const dateISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // Parse the resolved calendar date at UTC noon to compute the weekday.
  // Using noon avoids any Daylight-Saving-Time boundary edge cases where
  // midnight in a given timezone may shift the UTC date unexpectedly.
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = utcNoon.getUTCDay();

  return { dateISO, dayOfWeek };
}
