import { AnalyticsPageClient } from '@/features/analytics/components/analytics-page-client'
import { listWorkouts } from '@/features/workouts/service'

export default async function AnalyticsPage() {
    const workouts = await listWorkouts()

    return <AnalyticsPageClient initialWorkouts={workouts} />
}
