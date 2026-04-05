'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { useToast } from '@/components/ui/toast'
import {
    BODY_MEASUREMENT_FIELDS,
    type BodyMeasurementFieldKey,
} from '@/features/body-metrics/constants'
import {
    deleteBodyMeasurementAction,
    saveBodyMeasurementAction,
} from '@/features/body-metrics/actions'
import type {
    BodyMetricsPerformanceSnapshot,
    BodyMetricsSectionData,
} from '@/features/body-metrics/types'
import type { BodyMeasurement } from '@/lib/types'

interface BodyMetricsSectionProps {
    initialData: BodyMetricsSectionData
}

type BodyMeasurementFormState = Record<BodyMeasurementFieldKey, string> & {
    measuredAt: string
    notes: string
}

type CorrelationDescriptor = 'strong' | 'moderate' | 'weak' | 'none'

interface CorrelationInsight {
    id: string
    label: string
    coefficient: number
    sampleSize: number
    descriptor: CorrelationDescriptor
    direction: 'positive' | 'negative' | 'neutral'
}

function getTodayIso() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

function createEmptyFormState(): BodyMeasurementFormState {
    return {
        measuredAt: getTodayIso(),
        notes: '',
        height_cm: '',
        weight_kg: '',
        body_fat_pct: '',
        chest_cm: '',
        waist_cm: '',
        hips_cm: '',
        left_arm_cm: '',
        right_arm_cm: '',
        left_thigh_cm: '',
        right_thigh_cm: '',
        left_calf_cm: '',
        right_calf_cm: '',
    }
}

function toFormState(entry: BodyMeasurement): BodyMeasurementFormState {
    const baseState = createEmptyFormState()

    for (const field of BODY_MEASUREMENT_FIELDS) {
        baseState[field.key] = entry[field.key] == null ? '' : String(entry[field.key])
    }

    return {
        ...baseState,
        measuredAt: entry.measured_at,
        notes: entry.notes ?? '',
    }
}

function parseNullableNumber(value: string) {
    if (!value.trim()) {
        return null
    }

    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
}

function sortEntriesDescending(entries: BodyMeasurement[]) {
    return [...entries].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
}

function averagePair(left: number | null, right: number | null) {
    const values = [left, right].filter((value): value is number => value != null)
    if (values.length === 0) {
        return null
    }

    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function calculateLeanMass(entry: BodyMeasurement | null) {
    if (!entry || entry.weight_kg == null || entry.body_fat_pct == null) {
        return null
    }

    return Math.round(entry.weight_kg * (1 - entry.body_fat_pct / 100) * 10) / 10
}

function calculateCorrelation(points: Array<{ x: number; y: number }>) {
    if (points.length < 3) {
        return null
    }

    const count = points.length
    const sumX = points.reduce((sum, point) => sum + point.x, 0)
    const sumY = points.reduce((sum, point) => sum + point.y, 0)
    const avgX = sumX / count
    const avgY = sumY / count

    let numerator = 0
    let denominatorX = 0
    let denominatorY = 0

    for (const point of points) {
        const diffX = point.x - avgX
        const diffY = point.y - avgY
        numerator += diffX * diffY
        denominatorX += diffX ** 2
        denominatorY += diffY ** 2
    }

    if (denominatorX === 0 || denominatorY === 0) {
        return null
    }

    return numerator / Math.sqrt(denominatorX * denominatorY)
}

function getCorrelationDescriptor(coefficient: number): CorrelationDescriptor {
    const absolute = Math.abs(coefficient)

    if (absolute >= 0.7) {
        return 'strong'
    }

    if (absolute >= 0.4) {
        return 'moderate'
    }

    if (absolute >= 0.2) {
        return 'weak'
    }

    return 'none'
}

function getCorrelationDirection(coefficient: number) {
    if (coefficient > 0.1) {
        return 'positive' as const
    }

    if (coefficient < -0.1) {
        return 'negative' as const
    }

    return 'neutral' as const
}

function formatCorrelationCopy(t: ReturnType<typeof useTranslations>, insight: CorrelationInsight) {
    if (insight.descriptor === 'none' || insight.direction === 'neutral') {
        return t('BodyMetrics.correlationNeutral' as never)
    }

    const correlationKey = `BodyMetrics.correlation.${insight.descriptor}.${insight.direction}` as never
    return t(correlationKey)
}

function formatMetricValue(value: number | null | undefined, suffix = '', maximumFractionDigits = 1) {
    if (value == null) {
        return '—'
    }

    return `${value.toLocaleString(undefined, { maximumFractionDigits })}${suffix}`
}

function formatSignedDelta(value: number | null | undefined, suffix = '', maximumFractionDigits = 1) {
    if (value == null || value === 0) {
        return null
    }

    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits })}${suffix}`
}

export function BodyMetricsSection({ initialData }: BodyMetricsSectionProps) {
    const router = useRouter()
    const t = useTranslations()
    const { showToast } = useToast()
    const [entries, setEntries] = useState(() => sortEntriesDescending(initialData.entries))
    const [performanceSnapshots, setPerformanceSnapshots] = useState<BodyMetricsPerformanceSnapshot[]>(initialData.performanceSnapshots)
    const [form, setForm] = useState<BodyMeasurementFormState>(() => createEmptyFormState())
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        setEntries(sortEntriesDescending(initialData.entries))
        setPerformanceSnapshots(initialData.performanceSnapshots)
    }, [initialData.entries, initialData.performanceSnapshots])

    const latestEntry = entries[0] ?? null
    const previousEntry = entries[1] ?? null
    const latestLeanMass = calculateLeanMass(latestEntry)
    const previousLeanMass = calculateLeanMass(previousEntry)
    const latestSnapshot = performanceSnapshots[performanceSnapshots.length - 1] ?? null
    const weightDelta =
        latestEntry?.weight_kg != null && previousEntry?.weight_kg != null
            ? Number((latestEntry.weight_kg - previousEntry.weight_kg).toFixed(1))
            : null
    const bodyFatDelta =
        latestEntry?.body_fat_pct != null && previousEntry?.body_fat_pct != null
            ? Number((latestEntry.body_fat_pct - previousEntry.body_fat_pct).toFixed(1))
            : null
    const leanMassDelta =
        latestLeanMass != null && previousLeanMass != null
            ? Number((latestLeanMass - previousLeanMass).toFixed(1))
            : null

    const chartData = useMemo(() => {
        const performanceByDate = new Map(
            performanceSnapshots.map((snapshot) => [snapshot.measuredAt, snapshot]),
        )

        return [...entries]
            .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
            .map((entry) => {
                const snapshot = performanceByDate.get(entry.measured_at)

                return {
                    date: new Date(`${entry.measured_at}T00:00:00`).toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: '2-digit',
                    }),
                    fullDate: entry.measured_at,
                    weight: entry.weight_kg,
                    bodyFat: entry.body_fat_pct,
                    leanMass: calculateLeanMass(entry),
                    waist: entry.waist_cm,
                    armAverage: averagePair(entry.left_arm_cm, entry.right_arm_cm),
                    thighAverage: averagePair(entry.left_thigh_cm, entry.right_thigh_cm),
                    totalVolume: snapshot?.totalVolume ?? null,
                    averageSessionVolume: snapshot?.averageSessionVolume ?? null,
                    peakEstimated1RM: snapshot?.peakEstimated1RM ?? null,
                    sessionCount: snapshot?.sessionCount ?? 0,
                }
            })
    }, [entries, performanceSnapshots])

    const correlationInsights = useMemo(() => {
        const definitions = [
            {
                id: 'weight_peak_1rm',
                label: t('BodyMetrics.correlationWeightStrength'),
                selector: (point: (typeof chartData)[number]) => ({
                    x: point.weight,
                    y: point.peakEstimated1RM,
                }),
            },
            {
                id: 'body_fat_peak_1rm',
                label: t('BodyMetrics.correlationBodyFatStrength'),
                selector: (point: (typeof chartData)[number]) => ({
                    x: point.bodyFat,
                    y: point.peakEstimated1RM,
                }),
            },
            {
                id: 'waist_volume',
                label: t('BodyMetrics.correlationWaistVolume'),
                selector: (point: (typeof chartData)[number]) => ({
                    x: point.waist,
                    y: point.averageSessionVolume,
                }),
            },
        ]

        return definitions.flatMap((definition) => {
            const points = chartData
                .map((point) => definition.selector(point))
                .filter((point): point is { x: number; y: number } => point.x != null && point.y != null)

            const coefficient = calculateCorrelation(points)
            if (coefficient == null) {
                return []
            }

            return [{
                id: definition.id,
                label: definition.label,
                coefficient,
                sampleSize: points.length,
                descriptor: getCorrelationDescriptor(coefficient),
                direction: getCorrelationDirection(coefficient),
            }]
        })
    }, [chartData, t])

    const strongestCorrelation = useMemo(
        () =>
            [...correlationInsights].sort(
                (left, right) => Math.abs(right.coefficient) - Math.abs(left.coefficient),
            )[0] ?? null,
        [correlationInsights]
    )

    const correlationScatterData = useMemo(() => {
        if (!strongestCorrelation) {
            return []
        }

        if (strongestCorrelation.id === 'weight_peak_1rm') {
            return chartData
                .filter((point) => point.weight != null && point.peakEstimated1RM != null)
                .map((point) => ({
                    x: point.weight,
                    y: point.peakEstimated1RM,
                    date: point.date,
                }))
        }

        if (strongestCorrelation.id === 'body_fat_peak_1rm') {
            return chartData
                .filter((point) => point.bodyFat != null && point.peakEstimated1RM != null)
                .map((point) => ({
                    x: point.bodyFat,
                    y: point.peakEstimated1RM,
                    date: point.date,
                }))
        }

        return chartData
            .filter((point) => point.waist != null && point.averageSessionVolume != null)
            .map((point) => ({
                x: point.waist,
                y: point.averageSessionVolume,
                date: point.date,
            }))
    }, [chartData, strongestCorrelation])

    if (!initialData.enabled) {
        return (
            <div className="mt-8">
                <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t('BodyMetrics.title')}
                </h3>
                <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                    {t('BodyMetrics.unavailable')}
                </div>
            </div>
        )
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSaving(true)

        try {
            const result = await saveBodyMeasurementAction({
                measuredAt: form.measuredAt,
                notes: form.notes,
                height_cm: parseNullableNumber(form.height_cm),
                weight_kg: parseNullableNumber(form.weight_kg),
                body_fat_pct: parseNullableNumber(form.body_fat_pct),
                chest_cm: parseNullableNumber(form.chest_cm),
                waist_cm: parseNullableNumber(form.waist_cm),
                hips_cm: parseNullableNumber(form.hips_cm),
                left_arm_cm: parseNullableNumber(form.left_arm_cm),
                right_arm_cm: parseNullableNumber(form.right_arm_cm),
                left_thigh_cm: parseNullableNumber(form.left_thigh_cm),
                right_thigh_cm: parseNullableNumber(form.right_thigh_cm),
                left_calf_cm: parseNullableNumber(form.left_calf_cm),
                right_calf_cm: parseNullableNumber(form.right_calf_cm),
            })

            if (!result.ok || !result.data) {
                showToast(result.message ?? 'Unable to save body metrics', 'error')
                return
            }

            setEntries((prev) => sortEntriesDescending([
                ...prev.filter((entry) => entry.id !== result.data!.id && entry.measured_at !== result.data!.measured_at),
                result.data!,
            ]))
            setPerformanceSnapshots((prev) => prev.filter((snapshot) => snapshot.measuredAt !== result.data!.measured_at))
            setForm(createEmptyFormState())
            router.refresh()
            showToast(t('BodyMetrics.toastSaved'))
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        setDeletingId(id)
        try {
            const result = await deleteBodyMeasurementAction(id)
            if (!result.ok) {
                showToast(result.message ?? 'Unable to delete body metrics', 'error')
                return
            }

            const deletedEntry = entries.find((entry) => entry.id === id)
            setEntries((prev) => prev.filter((entry) => entry.id !== id))
            setPerformanceSnapshots((prev) =>
                prev.filter((snapshot) => snapshot.measuredAt !== deletedEntry?.measured_at)
            )
            router.refresh()
            showToast(t('BodyMetrics.toastDeleted'))
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="mt-8">
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t('BodyMetrics.title')}
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('BodyMetrics.latestWeight')}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                        {latestEntry?.weight_kg != null ? formatMetricValue(latestEntry.weight_kg, ' kg') : t('BodyMetrics.noWeightRecorded')}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400">{t('BodyMetrics.weightDelta')}</span>
                        <span className={`font-semibold ${
                            weightDelta == null
                                ? 'text-zinc-500 dark:text-zinc-400'
                                : weightDelta > 0
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                        }`}>
                            {formatSignedDelta(weightDelta, ' kg') ?? '—'}
                        </span>
                    </div>
                    <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t('BodyMetrics.lastCheckIn')}: {latestEntry?.measured_at ?? '—'}
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('BodyMetrics.latestBodyFat')}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                        {formatMetricValue(latestEntry?.body_fat_pct, '%')}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400">{t('BodyMetrics.weightDelta')}</span>
                        <span className={`font-semibold ${
                            bodyFatDelta == null
                                ? 'text-zinc-500 dark:text-zinc-400'
                                : bodyFatDelta > 0
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                        }`}>
                            {formatSignedDelta(bodyFatDelta, ' pp') ?? '—'}
                        </span>
                    </div>
                    <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t('BodyMetrics.latestLeanMass')}: {formatMetricValue(latestLeanMass, ' kg')}
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('BodyMetrics.latestPerformance')}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                        {latestSnapshot?.peakEstimated1RM != null
                            ? formatMetricValue(latestSnapshot.peakEstimated1RM, ' kg')
                            : '—'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400">{t('BodyMetrics.performanceWindow', { count: 21 })}</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">{latestSnapshot?.sessionCount ?? 0}x</span>
                    </div>
                    <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t('BodyMetrics.averageSessionVolume')}: {formatMetricValue(latestSnapshot?.averageSessionVolume)}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t('BodyMetrics.latestLeanMass')}: {formatSignedDelta(leanMassDelta, ' kg') ?? formatMetricValue(latestLeanMass, ' kg')}
                    </p>
                </div>
            </div>
            {entries.length > 0 ? (
                <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{t('BodyMetrics.compositionTrend')}</h4>
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('BodyMetrics.performanceWindow', { count: 21 })}</p>
                            </div>
                            <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                                <p>{t('BodyMetrics.latestLeanMass')}: {formatMetricValue(latestLeanMass, ' kg')}</p>
                                <p>{t('BodyMetrics.latestBodyFat')}: {formatMetricValue(latestEntry?.body_fat_pct, '%')}</p>
                            </div>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" />
                                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="currentColor" />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="currentColor" />
                                    <Tooltip
                                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate ?? label}
                                        formatter={(value, _name, item) => {
                                            if (typeof value !== 'number') {
                                                return [value, item.name]
                                            }

                                            const unit = item.dataKey === 'bodyFat' ? '%' : ' kg'
                                            return [formatMetricValue(value, unit), item.name]
                                        }}
                                        contentStyle={{
                                            borderRadius: '1rem',
                                            border: '1px solid rgba(113,113,122,0.25)',
                                            backgroundColor: 'rgba(24,24,27,0.94)',
                                        }}
                                    />
                                    <Line yAxisId="left" type="monotone" dataKey="weight" name={t('BodyMetrics.fields.weight')} stroke="#8b5cf6" strokeWidth={3} connectNulls />
                                    <Line yAxisId="left" type="monotone" dataKey="leanMass" name={t('BodyMetrics.latestLeanMass')} stroke="#10b981" strokeWidth={2} connectNulls />
                                    <Line yAxisId="right" type="monotone" dataKey="bodyFat" name={t('BodyMetrics.fields.bodyFat')} stroke="#f59e0b" strokeWidth={2} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{t('BodyMetrics.circumferenceTrend')}</h4>
                                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('BodyMetrics.lastCheckIn')}: {latestEntry?.measured_at ?? '—'}</p>
                                </div>
                                <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                                    <p>{t('BodyMetrics.fields.waist')}: {formatMetricValue(latestEntry?.waist_cm, ' cm')}</p>
                                    <p>{t('BodyMetrics.armAverage')}: {formatMetricValue(averagePair(latestEntry?.left_arm_cm ?? null, latestEntry?.right_arm_cm ?? null), ' cm')}</p>
                                </div>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" />
                                        <YAxis tick={{ fontSize: 12 }} stroke="currentColor" />
                                        <Tooltip
                                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate ?? label}
                                            formatter={(value, _name, item) => {
                                                if (typeof value !== 'number') {
                                                    return [value, item.name]
                                                }

                                                return [formatMetricValue(value, ' cm'), item.name]
                                            }}
                                            contentStyle={{
                                                borderRadius: '1rem',
                                                border: '1px solid rgba(113,113,122,0.25)',
                                                backgroundColor: 'rgba(24,24,27,0.94)',
                                            }}
                                        />
                                        <Line type="monotone" dataKey="waist" name={t('BodyMetrics.fields.waist')} stroke="#f97316" strokeWidth={3} connectNulls />
                                        <Line type="monotone" dataKey="armAverage" name={t('BodyMetrics.armAverage')} stroke="#06b6d4" strokeWidth={2} connectNulls />
                                        <Line type="monotone" dataKey="thighAverage" name={t('BodyMetrics.thighAverage')} stroke="#22c55e" strokeWidth={2} connectNulls />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{t('BodyMetrics.performanceTrend')}</h4>
                                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('BodyMetrics.performanceWindow', { count: 21 })}</p>
                                </div>
                                <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                                    <p>{t('BodyMetrics.totalVolumeWindow')}: {formatMetricValue(latestSnapshot?.totalVolume)}</p>
                                    <p>{t('BodyMetrics.peakEstimated1RM')}: {formatMetricValue(latestSnapshot?.peakEstimated1RM, ' kg')}</p>
                                </div>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" />
                                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="currentColor" />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="currentColor" />
                                        <Tooltip
                                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate ?? label}
                                            formatter={(value, _name, item) => {
                                                if (typeof value !== 'number') {
                                                    return [value, item.name]
                                                }

                                                const unit = item.dataKey === 'peakEstimated1RM' ? ' kg' : ''
                                                return [formatMetricValue(value, unit), item.name]
                                            }}
                                            contentStyle={{
                                                borderRadius: '1rem',
                                                border: '1px solid rgba(113,113,122,0.25)',
                                                backgroundColor: 'rgba(24,24,27,0.94)',
                                            }}
                                        />
                                        <Line yAxisId="left" type="monotone" dataKey="totalVolume" name={t('BodyMetrics.totalVolumeWindow')} stroke="#14b8a6" strokeWidth={3} connectNulls />
                                        <Line yAxisId="left" type="monotone" dataKey="averageSessionVolume" name={t('BodyMetrics.averageSessionVolume')} stroke="#0ea5e9" strokeWidth={2} connectNulls />
                                        <Line yAxisId="right" type="monotone" dataKey="peakEstimated1RM" name={t('BodyMetrics.peakEstimated1RM')} stroke="#e11d48" strokeWidth={2} connectNulls />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{t('BodyMetrics.performanceCorrelation')}</h4>
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    {strongestCorrelation
                                        ? formatCorrelationCopy(t, strongestCorrelation)
                                        : t('BodyMetrics.noPerformanceData')}
                                </p>
                            </div>
                            {strongestCorrelation && (
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                        {strongestCorrelation.coefficient.toFixed(2)}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {t('BodyMetrics.sampleSize', { count: strongestCorrelation.sampleSize })}
                                    </p>
                                </div>
                            )}
                        </div>

                        {correlationInsights.length > 0 && strongestCorrelation ? (
                            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                                <div className="space-y-3">
                                    {correlationInsights.map((insight) => (
                                        <div key={insight.id} className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{insight.label}</p>
                                                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatCorrelationCopy(t, insight)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{insight.coefficient.toFixed(2)}</p>
                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                        {t('BodyMetrics.sampleSize', { count: insight.sampleSize })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                                    <div className="mb-3">
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{strongestCorrelation.label}</p>
                                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatCorrelationCopy(t, strongestCorrelation)}</p>
                                    </div>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ScatterChart>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
                                                <XAxis type="number" dataKey="x" tick={{ fontSize: 12 }} stroke="currentColor" name={strongestCorrelation.label} />
                                                <YAxis type="number" dataKey="y" tick={{ fontSize: 12 }} stroke="currentColor" name={t('BodyMetrics.peakEstimated1RM')} />
                                                <Tooltip
                                                    formatter={(value) => {
                                                        if (typeof value !== 'number') {
                                                            return value
                                                        }

                                                        return formatMetricValue(value)
                                                    }}
                                                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                                                    contentStyle={{
                                                        borderRadius: '1rem',
                                                        border: '1px solid rgba(113,113,122,0.25)',
                                                        backgroundColor: 'rgba(24,24,27,0.94)',
                                                    }}
                                                />
                                                <Scatter data={correlationScatterData} fill="#8b5cf6" />
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                                {t('BodyMetrics.noPerformanceData')}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
                    {t('BodyMetrics.empty')}
                </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{t('BodyMetrics.newEntry')}</h4>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('BodyMetrics.measurementDate')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setForm(createEmptyFormState())}
                            className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        >
                            {t('Common.cancel')}
                        </button>
                    </div>

                    <div className="grid gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {t('BodyMetrics.measurementDate')}
                            </label>
                            <input
                                type="date"
                                value={form.measuredAt}
                                onChange={(event) => setForm((prev) => ({ ...prev, measuredAt: event.target.value }))}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {BODY_MEASUREMENT_FIELDS.map((field) => (
                                <label key={field.key} className="block">
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                        {t(`BodyMetrics.fields.${field.translationKey}`)}
                                    </span>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step={field.step}
                                            value={form[field.key]}
                                            onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                                            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 pr-12 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                        />
                                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-500 dark:text-zinc-400">
                                            {field.unit}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {t('BodyMetrics.notes')}
                            </label>
                            <textarea
                                value={form.notes}
                                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                                rows={3}
                                placeholder={t('BodyMetrics.notesPlaceholder')}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
                        >
                            {saving ? t('Common.loading') : t('BodyMetrics.saveEntry')}
                        </button>
                    </div>
                </form>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{t('BodyMetrics.history')}</h4>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{entries.length} {t('BodyMetrics.entriesCount')}</p>
                    </div>

                    {entries.length === 0 ? (
                        <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                            {t('BodyMetrics.empty')}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {entries.map((entry) => (
                                <div key={entry.id} className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{entry.measured_at}</p>
                                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                <span>{t('BodyMetrics.fields.weight')}: {formatMetricValue(entry.weight_kg, ' kg')}</span>
                                                <span>{t('BodyMetrics.fields.bodyFat')}: {formatMetricValue(entry.body_fat_pct, '%')}</span>
                                                <span>{t('BodyMetrics.fields.waist')}: {formatMetricValue(entry.waist_cm, ' cm')}</span>
                                            </div>
                                            {entry.notes && (
                                                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{entry.notes}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setForm(toFormState(entry))}
                                                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
                                            >
                                                {t('Common.edit')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(entry.id)}
                                                disabled={deletingId === entry.id}
                                                className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                                            >
                                                {deletingId === entry.id ? t('Common.loading') : t('Common.delete')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
