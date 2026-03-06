import 'server-only'

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedServerContext() {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) {
        throw new Error(error.message)
    }

    if (!user) {
        throw new Error('Unauthorized')
    }

    return { supabase, user }
}

export async function getOptionalUserServerContext(): Promise<{
    supabase: Awaited<ReturnType<typeof createClient>>
    user: User | null
}> {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) {
        throw new Error(error.message)
    }

    return { supabase, user }
}
