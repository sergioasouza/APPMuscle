'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'

export async function signInWithPasswordAction(
    email: string,
    password: string
): Promise<ActionResult<null>> {
    try {
        const supabase = await createClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            return errorResult(error)
        }

        revalidatePath('/', 'layout')

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function signOutAction(): Promise<ActionResult<null>> {
    try {
        const supabase = await createClient()
        const { error } = await supabase.auth.signOut()

        if (error) {
            return errorResult(error)
        }

        revalidatePath('/', 'layout')

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
