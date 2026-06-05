import { SchedulePageClient } from '@/features/schedule/components/schedule-page-client'
import { getSchedulePageData } from '@/features/schedule/service'

interface SchedulePageProps {
    searchParams?: Promise<{ previewDate?: string }>
}

function resolvePreviewDate(dateParam?: string) {
    return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : undefined
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined
    const data = await getSchedulePageData(resolvePreviewDate(resolvedSearchParams?.previewDate))

    return (
        <SchedulePageClient
            initialWorkouts={data.workouts}
            initialSchedule={data.schedule}
            initialRotations={data.rotations}
            initialRotationAnchorDate={data.rotationAnchorDate}
            initialRotationCycleLength={data.rotationCycleLength}
            initialPreviewDateISO={data.previewDateISO}
            rotationSupportEnabled={data.rotationSupportEnabled}
        />
    )
}
