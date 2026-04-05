import type { BodyMeasurement } from '@/lib/types'

export interface BodyMetricsPerformanceSnapshot {
    measuredAt: string
    sessionCount: number
    totalVolume: number
    averageSessionVolume: number | null
    peakEstimated1RM: number | null
}

export interface BodyMetricsSectionData {
    entries: BodyMeasurement[]
    enabled: boolean
    performanceSnapshots: BodyMetricsPerformanceSnapshot[]
}

export type BodyMeasurementInput = {
    measuredAt: string
    notes?: string
} & {
    [key in keyof Omit<
        BodyMeasurement,
        'id' | 'user_id' | 'measured_at' | 'notes' | 'created_at'
    >]?: number | null
}
