import { CalendarPageClient } from "@/features/calendar/components/calendar-page-client";
import { getCalendarMonth } from "@/features/calendar/service";
import { getTodayInTimezone } from "@/lib/utils";

// ---------------------------------------------------------------------------
// APP_TIMEZONE controls which IANA timezone the server uses when resolving
// "today".  Set it in .env.local (and in Vercel's Environment Variables):
//
//   APP_TIMEZONE=America/Sao_Paulo
//
// Defaults to America/Sao_Paulo when the variable is absent.
//
// WHY: Vercel's Node.js runtime runs in UTC.  Without this fix, a user in
// UTC-3 who opens the calendar after 21:00 local time would land on the
// wrong month when near a month boundary (e.g. Nov 30 at 22:00 local = Dec 1
// in UTC), causing the calendar to render the next month instead of today's.
// ---------------------------------------------------------------------------
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

export default async function CalendarPage() {
  // Resolve the current calendar date in the app's target timezone so that
  // the highlighted "today" cell and the initially-displayed month are both
  // correct for users in UTC-3 regardless of the server's system clock.
  const { dateISO: initialDate } = getTodayInTimezone(APP_TIMEZONE);

  // Extract year and 0-indexed month from the resolved ISO date string.
  // We parse from the string directly instead of constructing a Date object
  // to avoid any UTC-vs-local ambiguity at this boundary.
  const [yearStr, monthStr] = initialDate.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // getCalendarMonth expects 0-based month

  const initialData = await getCalendarMonth(year, month);

  return (
    <CalendarPageClient
      initialDate={initialDate}
      initialSessions={initialData.sessions}
      initialSchedule={initialData.schedule}
    />
  );
}
