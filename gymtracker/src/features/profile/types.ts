import type { BodyMetricsSectionData } from '@/features/body-metrics/types'

export interface ProfilePageData {
    email: string | null
    displayName: string | null
    bodyMetrics: BodyMetricsSectionData
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
