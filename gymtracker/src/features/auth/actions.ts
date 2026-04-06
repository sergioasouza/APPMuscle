'use server'

import { revalidatePath } from 'next/cache'
import { getOptionalAuthenticatedAppContext, resolvePostAuthDestination } from '@/lib/access-control'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'

export async function signInWithPasswordAction(
    email: string,
    password: string
): Promise<ActionResult<{ redirectTo: string }>> {
    try {
        const supabase = await createClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            return errorResult(error)
        }

        revalidatePath('/', 'layout')

        const context = await getOptionalAuthenticatedAppContext()

        if (!context.profile) {
            return errorResult(new Error('Profile not found after sign in'))
        }

        return okResult({
            redirectTo: resolvePostAuthDestination(context.profile, context.todayISO),
        })
    } catch (error) {
        return errorResult(error)
    }
}

export async function requestPasswordResetAction(
    email: string,
): Promise<ActionResult<null>> {
    try {
        const normalizedEmail = email.trim().toLowerCase()

        if (!normalizedEmail) {
            throw new Error('Email is required')
        }

        const supabase = await createClient()
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

        if (!siteUrl) {
            throw new Error('Missing NEXT_PUBLIC_SITE_URL')
        }

        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: `${siteUrl}/auth/callback?next=/auth/change-password`,
        })

        if (error) {
            return errorResult(error)
        }

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function changePasswordAction(
    password: string,
): Promise<ActionResult<{ redirectTo: string }>> {
    try {
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long')
        }

        const supabase = await createClient()
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
            throw new Error(userError.message)
        }

        if (!user) {
            throw new Error('Unauthorized')
        }

        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            return errorResult(error)
        }

        const serviceRole = getServiceRoleClient()
        const { error: profileError } = await serviceRole
            .from('profiles')
            .update({ must_change_password: false })
            .eq('id', user.id)

        if (profileError) {
            throw new Error(profileError.message)
        }

        const context = await getOptionalAuthenticatedAppContext()

        if (!context.profile) {
            throw new Error('Profile not found after password change')
        }

        revalidatePath('/', 'layout')

        return okResult({
            redirectTo: resolvePostAuthDestination(context.profile, context.todayISO),
        })
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

export async function sendTemporaryPasswordResetAction(
    userId: string,
    temporaryPassword: string,
): Promise<ActionResult<null>> {
    try {
        if (!temporaryPassword || temporaryPassword.length < 8) {
            throw new Error('Temporary password must be at least 8 characters long')
        }

        const serviceRole = getServiceRoleClient()
        const { error: authError } = await serviceRole.auth.admin.updateUserById(
            userId,
            { password: temporaryPassword, email_confirm: true },
        )

        if (authError) {
            throw new Error(authError.message)
        }

        const { error: profileError } = await serviceRole
            .from('profiles')
            .update({ must_change_password: true })
            .eq('id', userId)

        if (profileError) {
            throw new Error(profileError.message)
        }

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
