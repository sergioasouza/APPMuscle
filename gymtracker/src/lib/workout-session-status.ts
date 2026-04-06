export type WorkoutSessionStatusKind =
    | 'normal'
    | 'skipped'
    | 'rescheduled_to'
    | 'rescheduled_from'

export interface ParsedWorkoutSessionStatus {
    kind: WorkoutSessionStatusKind
    raw: string | null
    dateISO: string | null
    label: string | null
    details: string | null
}

const SKIPPED_PREFIX = '[SKIPPED]'
const MODERN_RESCHEDULED_PATTERN =
    /^\[(RESCHEDULED_TO|RESCHEDULED_FROM)\s+(\d{4}-\d{2}-\d{2})\|([^\]]+)\](?:\s*([\s\S]*))?$/
const LEGACY_RESCHEDULED_PATTERN =
    /^\[RESCHEDULED (TO|FROM)\s+([^\]]+)\](?:\s*([\s\S]*))?$/

function cleanDetails(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized ? normalized : null
}

function joinStatusPrefix(prefix: string, details: string | null) {
    return details ? `${prefix} ${details}` : prefix
}

export function parseWorkoutSessionStatus(notes: string | null | undefined): ParsedWorkoutSessionStatus {
    const raw = notes?.trim() ?? null

    if (!raw) {
        return {
            kind: 'normal',
            raw: null,
            dateISO: null,
            label: null,
            details: null,
        }
    }

    if (raw.startsWith(SKIPPED_PREFIX)) {
        return {
            kind: 'skipped',
            raw,
            dateISO: null,
            label: null,
            details: cleanDetails(raw.slice(SKIPPED_PREFIX.length)),
        }
    }

    const modernMatch = raw.match(MODERN_RESCHEDULED_PATTERN)
    if (modernMatch) {
        return {
            kind: modernMatch[1] === 'RESCHEDULED_TO' ? 'rescheduled_to' : 'rescheduled_from',
            raw,
            dateISO: modernMatch[2] ?? null,
            label: modernMatch[3]?.trim() ?? null,
            details: cleanDetails(modernMatch[4]),
        }
    }

    const legacyMatch = raw.match(LEGACY_RESCHEDULED_PATTERN)
    if (legacyMatch) {
        return {
            kind: legacyMatch[1] === 'TO' ? 'rescheduled_to' : 'rescheduled_from',
            raw,
            dateISO: null,
            label: legacyMatch[2]?.trim() ?? null,
            details: cleanDetails(legacyMatch[3]),
        }
    }

    return {
        kind: 'normal',
        raw,
        dateISO: null,
        label: null,
        details: raw,
    }
}

export function isSkippedWorkoutSession(notes: string | null | undefined) {
    return parseWorkoutSessionStatus(notes).kind === 'skipped'
}

export function isRescheduledSourceWorkoutSession(notes: string | null | undefined) {
    return parseWorkoutSessionStatus(notes).kind === 'rescheduled_to'
}

export function isRescheduledTargetWorkoutSession(notes: string | null | undefined) {
    return parseWorkoutSessionStatus(notes).kind === 'rescheduled_from'
}

export function isAnalyticsExcludedWorkoutSession(notes: string | null | undefined) {
    const status = parseWorkoutSessionStatus(notes)
    return status.kind === 'skipped' || status.kind === 'rescheduled_to'
}

export function buildSkippedWorkoutSessionNote(existingNotes: string | null | undefined) {
    const details = cleanDetails(existingNotes)
    return details ? `${SKIPPED_PREFIX} ${details}` : SKIPPED_PREFIX
}

export function removeSkippedWorkoutSessionNote(notes: string | null | undefined) {
    const status = parseWorkoutSessionStatus(notes)
    if (status.kind !== 'skipped') {
        return cleanDetails(notes)
    }

    return status.details
}

export function clearWorkoutSessionStatus(notes: string | null | undefined) {
    return parseWorkoutSessionStatus(notes).details
}

export function buildWorkoutSessionNotesWithStatus(
    existingNotes: string | null | undefined,
    nextDetails: string | null | undefined,
) {
    const status = parseWorkoutSessionStatus(existingNotes)
    const details = cleanDetails(nextDetails)

    if (status.kind === 'normal') {
        return details
    }

    if (status.kind === 'skipped') {
        return joinStatusPrefix(SKIPPED_PREFIX, details)
    }

    if (status.kind === 'rescheduled_to') {
        if (status.dateISO && status.label) {
            return buildRescheduledToWorkoutSessionNote({
                targetDateISO: status.dateISO,
                targetLabel: status.label,
                existingNotes: details,
            })
        }

        return joinStatusPrefix(`[RESCHEDULED TO ${status.label ?? ''}]`, details)
    }

    if (status.dateISO && status.label) {
        return buildRescheduledFromWorkoutSessionNote({
            sourceDateISO: status.dateISO,
            sourceLabel: status.label,
            existingNotes: details,
        })
    }

    return joinStatusPrefix(`[RESCHEDULED FROM ${status.label ?? ''}]`, details)
}

export function buildRescheduledToWorkoutSessionNote(input: {
    targetDateISO: string
    targetLabel: string
    existingNotes?: string | null
}) {
    const details = cleanDetails(input.existingNotes)
    const base = `[RESCHEDULED_TO ${input.targetDateISO}|${input.targetLabel}]`
    return details ? `${base} ${details}` : base
}

export function buildRescheduledFromWorkoutSessionNote(input: {
    sourceDateISO: string
    sourceLabel: string
    existingNotes?: string | null
}) {
    const details = cleanDetails(input.existingNotes)
    const base = `[RESCHEDULED_FROM ${input.sourceDateISO}|${input.sourceLabel}]`
    return details ? `${base} ${details}` : base
}
