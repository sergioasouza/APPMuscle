import { WorkoutsPageClient } from '@/features/workouts/components/workouts-page-client'
import { listWorkouts } from '@/features/workouts/service'

export default async function WorkoutsPage() {
    const workouts = await listWorkouts()

    return <WorkoutsPageClient initialWorkouts={workouts} />
}
