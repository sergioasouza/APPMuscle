import { CalendarPageClient } from '@/features/calendar/components/calendar-page-client'
import { getCalendarMonth } from '@/features/calendar/service'
import { formatDateISO } from '@/lib/utils'

export default async function CalendarPage() {
    const today = new Date()
    const initialDate = formatDateISO(today)
    const initialData = await getCalendarMonth(today.getFullYear(), today.getMonth())

    return <CalendarPageClient initialDate={initialDate} initialSessions={initialData.sessions} />
}
