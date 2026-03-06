import 'server-only'

import { createClient } from '@/lib/supabase/server'

export async function getProfilePageDataRepository() {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) {
        throw new Error(error.message)
    }

    if (!user) {
        return {
            email: null,
            displayName: null,
        }
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()

    if (profileError) {
        throw new Error(profileError.message)
    }

    return {
        email: user.email ?? null,
        displayName: profile?.display_name ?? null,
    }
}

export async function signOutRepository() {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
        throw new Error(error.message)
    }
}
