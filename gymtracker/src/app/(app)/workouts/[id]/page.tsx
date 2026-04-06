import { notFound } from 'next/navigation'
import { WorkoutEditorClient } from '@/features/workouts/components/workout-editor-client'
import { getWorkoutEditorData } from '@/features/workouts/service'

interface EditWorkoutPageProps {
    params: Promise<{ id: string }>
}

export default async function EditWorkoutPage({ params }: EditWorkoutPageProps) {
    const { id } = await params
    const workoutData = await getWorkoutEditorData(id)

    if (!workoutData) {
        notFound()
    }

    return (
        <WorkoutEditorClient
            initialWorkout={workoutData.workout}
            initialWorkoutExercises={workoutData.workoutExercises}
            initialCardioBlocks={workoutData.cardioBlocks}
        />
    )
}
