import { TodayPageClient } from "@/features/today/components/today-page-client";
import { getTodayView } from "@/features/today/service";
import type { TodayViewData } from "@/features/today/types";
import { getTodayInTimezone } from "@/lib/utils";

// ---------------------------------------------------------------------------
// APP_TIMEZONE controls which IANA timezone the server uses when resolving
// "today".  Set it in .env.local (and in Vercel's Environment Variables) to
// match your users' locale, e.g.:
//
//   APP_TIMEZONE=America/Sao_Paulo
//
// Defaults to America/Sao_Paulo when the variable is absent.
//
// WHY: Vercel's Node.js runtime runs in UTC.  Without this override, a user
// in UTC-3 who opens the app at 22:00 local time would see tomorrow's date
// because `new Date()` on the server already ticked past UTC midnight.
// ---------------------------------------------------------------------------
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

interface TodayPageProps {
  searchParams?: Promise<{ date?: string }>;
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const dateParam = resolvedSearchParams?.date;

  let dateISO: string;
  let dayOfWeek: number;

  if (dateParam) {
    // -----------------------------------------------------------------------
    // Historical navigation: the client already sent a YYYY-MM-DD string, so
    // we trust it directly.  We still need to compute the weekday — parse at
    // UTC noon to avoid any DST boundary edge cases where midnight in a
    // given timezone could shift the underlying UTC date by one day.
    // -----------------------------------------------------------------------
    dateISO = dateParam;
    const [y, m, d] = dateParam.split("-").map(Number);
    dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  } else {
    // -----------------------------------------------------------------------
    // Current-day view: resolve the calendar date in the app's target timezone
    // so that a user in UTC-3 at 22:30 local time sees the correct local date
    // instead of the UTC date (which would already be tomorrow).
    // -----------------------------------------------------------------------
    const today = getTodayInTimezone(APP_TIMEZONE);
    dateISO = today.dateISO;
    dayOfWeek = today.dayOfWeek;
  }

  let initialData: TodayViewData;

  try {
    initialData = await getTodayView(dateISO, dayOfWeek);
  } catch (error) {
    console.error("TodayPage/getTodayView failed", {
      dateISO,
      dayOfWeek,
      error,
    });
    initialData = {
      workout: null,
      session: null,
      exerciseLogs: [],
      notes: "",
    };
  }

  return (
    <TodayPageClient
      dateISO={dateISO}
      dayOfWeek={dayOfWeek}
      isHistorical={!!dateParam}
      initialData={initialData}
    />
  );
}
