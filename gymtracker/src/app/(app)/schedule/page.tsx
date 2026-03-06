import { SchedulePageClient } from '@/features/schedule/components/schedule-page-client'
import { getSchedulePageData } from '@/features/schedule/service'

export default async function SchedulePage() {
    const data = await getSchedulePageData()

    return <SchedulePageClient initialWorkouts={data.workouts} initialSchedule={data.schedule} />
}
