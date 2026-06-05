import 'server-only'

import { getBodyMetricsSectionData } from '@/features/body-metrics/service'
import { getOptionalUserServerContext } from '@/lib/supabase/auth'

export async function getProfilePageDataRepository() {
    const { supabase, user } = await getOptionalUserServerContext()

    if (!user) {
        return {
            email: null,
            displayName: null,
            role: null,
            accessStatus: null,
            memberAccessMode: null,
            billingDayOfMonth: null,
            paidUntil: null,
            trialEndsAt: null,
            createdAt: null,
            bodyMetrics: {
                entries: [],
                enabled: false,
                performanceSnapshots: [],
            },
        }
    }

    const [{ data: profile, error: profileError }, bodyMeasurements] = await Promise.all([
        supabase
            .from('profiles')
            .select(
                'display_name, role, access_status, member_access_mode, billing_day_of_month, paid_until, trial_ends_at, created_at',
            )
            .eq('id', user.id)
            .maybeSingle(),
        getBodyMetricsSectionData(),
    ])

    if (profileError) {
        throw new Error(profileError.message)
    }

    return {
        email: user.email ?? null,
        displayName: profile?.display_name ?? null,
        role: profile?.role ?? null,
        accessStatus: profile?.access_status ?? null,
        memberAccessMode: profile?.member_access_mode ?? null,
        billingDayOfMonth: profile?.billing_day_of_month ?? null,
        paidUntil: profile?.paid_until ?? null,
        trialEndsAt: profile?.trial_ends_at ?? null,
        createdAt: profile?.created_at ?? null,
        bodyMetrics: {
            entries: bodyMeasurements.entries,
            enabled: bodyMeasurements.enabled,
            performanceSnapshots: bodyMeasurements.performanceSnapshots,
        },
    }
}
