import type { BodyMetricsSectionData } from '@/features/body-metrics/types'
import type { Profile } from '@/lib/types'

export interface ProfilePageData {
    email: string | null
    displayName: string | null
    role: Profile['role'] | null
    accessStatus: Profile['access_status'] | null
    memberAccessMode: Profile['member_access_mode'] | null
    billingDayOfMonth: number | null
    paidUntil: string | null
    trialEndsAt: string | null
    createdAt: string | null
    bodyMetrics: BodyMetricsSectionData
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
