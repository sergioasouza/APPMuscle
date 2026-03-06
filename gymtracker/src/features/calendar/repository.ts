import 'server-only'

import { formatDateISO } from '@/lib/utils'
import { getAuthenticatedServerContext } from '@/lib/supabase/auth'

export async function getCalendarMonthRepository(year: number, month: number) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 0)

    const { data, error } = await supabase
        .from('workout_sessions')
        .select('*, workouts(*)')
        .eq('user_id', user.id)
        .gte('performed_at', formatDateISO(startOfMonth))
        .lte('performed_at', formatDateISO(endOfMonth))
        .order('performed_at')

    if (error) {
        throw new Error(error.message)
    }

    return data ?? []
}

export async function getSessionSetsRepository(sessionId: string) {
    const { supabase } = await getAuthenticatedServerContext()

    const { data, error } = await supabase
        .from('set_logs')
        .select('*, exercises(*)')
        .eq('session_id', sessionId)
        .order('exercise_id')
        .order('set_number')

    if (error) {
        throw new Error(error.message)
    }

    return data ?? []
}
