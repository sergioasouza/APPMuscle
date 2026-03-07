import { TodayPageClient } from '@/features/today/components/today-page-client'
import { getTodayView } from '@/features/today/service'
import type { TodayViewData } from '@/features/today/types'
import { formatDateISO } from '@/lib/utils'

interface TodayPageProps {
    searchParams?: Promise<{ date?: string }>
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined
    const dateParam = resolvedSearchParams?.date
    const date = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()
    const dateISO = formatDateISO(date)
    const dayOfWeek = date.getDay()
    let initialData: TodayViewData

    try {
        initialData = await getTodayView(dateISO, dayOfWeek)
    } catch (error) {
        console.error('TodayPage/getTodayView failed', { dateISO, dayOfWeek, error })
        initialData = {
            workout: null,
            session: null,
            exerciseLogs: [],
            notes: '',
        }
    }

    return (
        <TodayPageClient
            dateISO={dateISO}
            dayOfWeek={dayOfWeek}
            isHistorical={!!dateParam}
            initialData={initialData}
        />
    )
}
