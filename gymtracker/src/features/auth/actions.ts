'use server'

import { createClient } from '@/lib/supabase/server'

export interface AuthActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}

export async function signInWithPasswordAction(
    email: string,
    password: string
): Promise<AuthActionResult<null>> {
    try {
        const supabase = await createClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            return { ok: false, message: error.message }
        }

        return { ok: true, data: null }
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Unexpected error',
        }
    }
}
