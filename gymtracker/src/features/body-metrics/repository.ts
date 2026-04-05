import 'server-only'

import { getAuthenticatedServerContext } from '@/lib/supabase/auth'
import type { BodyMeasurementInput } from '@/features/body-metrics/types'
import { isMissingTableError, toMigrationRequiredError } from '@/lib/supabase/schema-compat'
import type { SetLog, WorkoutSession } from '@/lib/types'

export async function listBodyMeasurementsRepository() {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(24)

    if (error) {
        if (isMissingTableError(error, 'body_measurements')) {
            return {
                entries: [],
                enabled: false,
            }
        }

        throw new Error(error.message)
    }

    return {
        entries: data ?? [],
        enabled: true,
    }
}

export async function upsertBodyMeasurementRepository(input: BodyMeasurementInput) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const payload = {
        user_id: user.id,
        measured_at: input.measuredAt,
        height_cm: input.height_cm ?? null,
        weight_kg: input.weight_kg ?? null,
        body_fat_pct: input.body_fat_pct ?? null,
        chest_cm: input.chest_cm ?? null,
        waist_cm: input.waist_cm ?? null,
        hips_cm: input.hips_cm ?? null,
        left_arm_cm: input.left_arm_cm ?? null,
        right_arm_cm: input.right_arm_cm ?? null,
        left_thigh_cm: input.left_thigh_cm ?? null,
        right_thigh_cm: input.right_thigh_cm ?? null,
        left_calf_cm: input.left_calf_cm ?? null,
        right_calf_cm: input.right_calf_cm ?? null,
        notes: input.notes?.trim() || null,
    }

    const { data, error } = await supabase
        .from('body_measurements')
        .upsert(payload, { onConflict: 'user_id,measured_at' })
        .select('*')
        .single()

    if (error) {
        if (isMissingTableError(error, 'body_measurements')) {
            throw toMigrationRequiredError('Body metrics')
        }

        throw new Error(error.message)
    }

    return data
}

export async function listBodyMetricPerformanceRepository(windowStartISO: string) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('performed_at', windowStartISO)
        .order('performed_at')

    if (sessionsError) {
        throw new Error(sessionsError.message)
    }

    const sessionIds = (sessions as WorkoutSession[] | null)?.map((session) => session.id) ?? []

    if (sessionIds.length === 0) {
        return {
            sessions: [] as WorkoutSession[],
            setLogs: [] as SetLog[],
        }
    }

    const { data: setLogs, error: setLogsError } = await supabase
        .from('set_logs')
        .select('*')
        .in('session_id', sessionIds)

    if (setLogsError) {
        throw new Error(setLogsError.message)
    }

    return {
        sessions: (sessions as WorkoutSession[] | null) ?? [],
        setLogs: (setLogs as SetLog[] | null) ?? [],
    }
}

export async function deleteBodyMeasurementRepository(id: string) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { error } = await supabase
        .from('body_measurements')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        if (isMissingTableError(error, 'body_measurements')) {
            throw toMigrationRequiredError('Body metrics')
        }

        throw new Error(error.message)
    }
}
