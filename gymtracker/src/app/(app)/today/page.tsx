import { TodayPageClient } from '@/features/today/components/today-page-client'
import { getTodayView } from '@/features/today/service'
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
    const initialData = await getTodayView(dateISO, dayOfWeek)

    return (
        <TodayPageClient
            dateISO={dateISO}
            dayOfWeek={dayOfWeek}
            isHistorical={!!dateParam}
            initialData={initialData}
        />
    )
}
