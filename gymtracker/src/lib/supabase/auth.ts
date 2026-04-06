import 'server-only'

import type { User } from '@supabase/supabase-js'
import {
    getOptionalAuthenticatedAppContext,
    getRequiredAuthenticatedAppContext,
    isProfileAdmin,
    isProfileAccessActive,
} from '@/lib/access-control'
import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedServerContext() {
    const context = await getRequiredAuthenticatedAppContext()

    if (isProfileAdmin(context.profile)) {
        throw new Error('Admin accounts cannot use member routes')
    }

    if (
        context.profile.must_change_password ||
        !isProfileAccessActive(context.profile, context.todayISO)
    ) {
        throw new Error('Member account is not allowed to use the app')
    }

    return { supabase: context.supabase, user: context.user, profile: context.profile, todayISO: context.todayISO }
}

export async function getAdminServerContext() {
    const context = await getRequiredAuthenticatedAppContext()

    if (!isProfileAdmin(context.profile)) {
        throw new Error('Forbidden')
    }

    return context
}

export async function getAuthenticatedAppContext() {
    return getRequiredAuthenticatedAppContext()
}

export async function getOptionalUserServerContext(): Promise<{
    supabase: Awaited<ReturnType<typeof createClient>>
    user: User | null
}> {
    const context = await getOptionalAuthenticatedAppContext()

    return { supabase: context.supabase, user: context.user }
}
