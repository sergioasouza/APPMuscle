'use server'

import { signOut } from '@/features/profile/service'
import type { ActionResult } from '@/features/profile/types'

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error'
}

export async function signOutAction(): Promise<ActionResult<null>> {
    try {
        await signOut()
        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}
