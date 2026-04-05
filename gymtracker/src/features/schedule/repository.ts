import 'server-only'

import { getAuthenticatedServerContext } from '@/lib/supabase/auth'
import { requireOwnedWorkout } from '@/lib/supabase/ownership'
import { buildScheduleDayPlan, getRotationCycleLength } from '@/features/schedule/rotation'
import {
    isMissingColumnError,
    isMissingTableError,
    toMigrationRequiredError,
} from '@/lib/supabase/schema-compat'
import { getTodayInTimezone } from '@/lib/utils'

export async function getSchedulePageDataRepository() {
    const { supabase, user } = await getAuthenticatedServerContext()

    const [workoutsRes, scheduleRes, rotationsRes, profileRes] = await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', user.id).order('name'),
        supabase
            .from('schedule')
            .select('*, workouts(*)')
            .eq('user_id', user.id)
            .order('day_of_week'),
        supabase
            .from('schedule_rotations')
            .select('*, workouts(*)')
            .eq('user_id', user.id)
            .order('day_of_week')
            .order('rotation_index'),
        supabase
            .from('profiles')
            .select('rotation_anchor_date')
            .eq('id', user.id)
            .maybeSingle(),
    ])

    if (workoutsRes.error) {
        throw new Error(workoutsRes.error.message)
    }

    if (scheduleRes.error) {
        throw new Error(scheduleRes.error.message)
    }

    const rotationSupportEnabled = !isMissingTableError(rotationsRes.error, 'schedule_rotations')

    if (rotationsRes.error && rotationSupportEnabled) {
        throw new Error(rotationsRes.error.message)
    }

    const rotationAnchorColumnAvailable = !isMissingColumnError(profileRes.error, 'rotation_anchor_date')

    if (profileRes.error && rotationAnchorColumnAvailable) {
        throw new Error(profileRes.error.message)
    }

    const schedule = scheduleRes.data ?? []
    const rotations = rotationSupportEnabled ? rotationsRes.data ?? [] : []
    const rotationAnchorDate = rotationAnchorColumnAvailable ? profileRes.data?.rotation_anchor_date ?? null : null
    const rotationCycleLength = getRotationCycleLength(rotations)
    const appTimezone = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo'
    const todayISO = getTodayInTimezone(appTimezone).dateISO

    return {
        workouts: workoutsRes.data ?? [],
        schedule,
        rotations,
        rotationAnchorDate,
        rotationCycleLength,
        previewDateISO: todayISO,
        rotationSupportEnabled: rotationSupportEnabled && rotationAnchorColumnAvailable,
        dayPlans: Array.from({ length: 7 }, (_, dayOfWeek) =>
            buildScheduleDayPlan({
                dayOfWeek,
                dateISO: todayISO,
                anchorDateISO: rotationAnchorDate,
                baseEntry: schedule.find((entry) => entry.day_of_week === dayOfWeek),
                extraRotations: rotations.filter((entry) => entry.day_of_week === dayOfWeek),
                cycleLength: rotationCycleLength,
            })
        ),
    }
}

export async function assignWorkoutToDayRepository(dayOfWeek: number, workoutId: string) {
    const { supabase, user } = await getAuthenticatedServerContext()
    await requireOwnedWorkout(supabase, user.id, workoutId)

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
        const { error: deleteError } = await supabase
            .from('schedule')
            .delete()
            .eq('id', existing.id)
            .eq('user_id', user.id)
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

    const [scheduleDelete, rotationsDelete] = await Promise.all([
        supabase
            .from('schedule')
            .delete()
            .eq('user_id', user.id)
            .eq('day_of_week', dayOfWeek),
        supabase
            .from('schedule_rotations')
            .delete()
            .eq('user_id', user.id)
            .eq('day_of_week', dayOfWeek),
    ])

    if (scheduleDelete.error) {
        throw new Error(scheduleDelete.error.message)
    }

    if (rotationsDelete.error && !isMissingTableError(rotationsDelete.error, 'schedule_rotations')) {
        throw new Error(rotationsDelete.error.message)
    }
}

export async function upsertScheduleRotationRepository(dayOfWeek: number, rotationIndex: number, workoutId: string) {
    const { supabase, user } = await getAuthenticatedServerContext()
    await requireOwnedWorkout(supabase, user.id, workoutId)

    const { data, error } = await supabase
        .from('schedule_rotations')
        .upsert(
            {
                user_id: user.id,
                workout_id: workoutId,
                day_of_week: dayOfWeek,
                rotation_index: rotationIndex,
            },
            { onConflict: 'user_id,day_of_week,rotation_index' }
        )
        .select('*, workouts(*)')
        .single()

    if (error) {
        if (isMissingTableError(error, 'schedule_rotations')) {
            throw toMigrationRequiredError('Workout rotation')
        }

        throw new Error(error.message)
    }

    return data
}

export async function clearScheduleRotationRepository(dayOfWeek: number, rotationIndex: number) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { error } = await supabase
        .from('schedule_rotations')
        .delete()
        .eq('user_id', user.id)
        .eq('day_of_week', dayOfWeek)
        .eq('rotation_index', rotationIndex)

    if (error) {
        if (isMissingTableError(error, 'schedule_rotations')) {
            throw toMigrationRequiredError('Workout rotation')
        }

        throw new Error(error.message)
    }
}

export async function updateRotationAnchorDateRepository(rotationAnchorDate: string) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { error } = await supabase
        .from('profiles')
        .update({ rotation_anchor_date: rotationAnchorDate })
        .eq('id', user.id)

    if (error) {
        if (isMissingColumnError(error, 'rotation_anchor_date')) {
            throw toMigrationRequiredError('Workout rotation')
        }

        throw new Error(error.message)
    }
}

export async function createRotationWeekFromBaseRepository(rotationIndex: number) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { data: baseSchedule, error: scheduleError } = await supabase
        .from('schedule')
        .select('*')
        .eq('user_id', user.id)

    if (scheduleError) {
        throw new Error(scheduleError.message)
    }

    const rows = (baseSchedule ?? []).map((entry) => ({
        user_id: user.id,
        workout_id: entry.workout_id,
        day_of_week: entry.day_of_week,
        rotation_index: rotationIndex,
    }))

    if (rows.length === 0) {
        return []
    }

    const { data, error } = await supabase
        .from('schedule_rotations')
        .upsert(rows, { onConflict: 'user_id,day_of_week,rotation_index' })
        .select('*, workouts(*)')

    if (error) {
        if (isMissingTableError(error, 'schedule_rotations')) {
            throw toMigrationRequiredError('Workout rotation')
        }

        throw new Error(error.message)
    }

    return data ?? []
}

export async function clearRotationWeekRepository(rotationIndex: number) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { error } = await supabase
        .from('schedule_rotations')
        .delete()
        .eq('user_id', user.id)
        .eq('rotation_index', rotationIndex)

    if (error) {
        if (isMissingTableError(error, 'schedule_rotations')) {
            throw toMigrationRequiredError('Workout rotation')
        }

        throw new Error(error.message)
    }
}
