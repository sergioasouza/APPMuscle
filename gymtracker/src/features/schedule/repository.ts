import 'server-only'

import { getAuthenticatedServerContext } from '@/lib/supabase/auth'

export async function getSchedulePageDataRepository() {
    const { supabase, user } = await getAuthenticatedServerContext()

    const [workoutsRes, scheduleRes] = await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', user.id).order('name'),
        supabase
            .from('schedule')
            .select('*, workouts(*)')
            .eq('user_id', user.id)
            .order('day_of_week'),
    ])

    if (workoutsRes.error) {
        throw new Error(workoutsRes.error.message)
    }

    if (scheduleRes.error) {
        throw new Error(scheduleRes.error.message)
    }

    return {
        workouts: workoutsRes.data ?? [],
        schedule: scheduleRes.data ?? [],
    }
}

export async function assignWorkoutToDayRepository(dayOfWeek: number, workoutId: string) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { data: existing, error: existingError } = await supabase
        .from('schedule')
        .select('id')
        .eq('user_id', user.id)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle()

    if (existingError) {
        throw new Error(existingError.message)
    }

    if (existing) {
        const { error: deleteError } = await supabase.from('schedule').delete().eq('id', existing.id)
        if (deleteError) {
            throw new Error(deleteError.message)
        }
    }

    const { data, error } = await supabase
        .from('schedule')
        .insert({
            user_id: user.id,
            workout_id: workoutId,
            day_of_week: dayOfWeek,
        })
        .select('*, workouts(*)')
        .single()

    if (error) {
        throw new Error(error.message)
    }

    return data
}

export async function clearScheduleDayRepository(dayOfWeek: number) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { error } = await supabase
        .from('schedule')
        .delete()
        .eq('user_id', user.id)
        .eq('day_of_week', dayOfWeek)

    if (error) {
        throw new Error(error.message)
    }
}
