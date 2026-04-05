import 'server-only'

import { getBodyMetricsSectionData } from '@/features/body-metrics/service'
import { getOptionalUserServerContext } from '@/lib/supabase/auth'

export async function getProfilePageDataRepository() {
    const { supabase, user } = await getOptionalUserServerContext()

    if (!user) {
        return {
            email: null,
            displayName: null,
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
            .select('display_name')
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
        bodyMetrics: {
            entries: bodyMeasurements.entries,
            enabled: bodyMeasurements.enabled,
            performanceSnapshots: bodyMeasurements.performanceSnapshots,
        },
    }
}
