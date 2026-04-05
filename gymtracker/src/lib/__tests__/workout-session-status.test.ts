import {
    buildRescheduledFromWorkoutSessionNote,
    buildRescheduledToWorkoutSessionNote,
    buildSkippedWorkoutSessionNote,
    buildWorkoutSessionNotesWithStatus,
    isAnalyticsExcludedWorkoutSession,
    parseWorkoutSessionStatus,
    removeSkippedWorkoutSessionNote,
} from '@/lib/workout-session-status'

describe('workout-session-status', () => {
    it('parses modern reschedule markers and keeps free-form details', () => {
        const notes = buildRescheduledToWorkoutSessionNote({
            targetDateISO: '2026-04-07',
            targetLabel: 'Tuesday',
            existingNotes: 'Need extra recovery',
        })

        expect(parseWorkoutSessionStatus(notes)).toEqual({
            kind: 'rescheduled_to',
            raw: '[RESCHEDULED_TO 2026-04-07|Tuesday] Need extra recovery',
            dateISO: '2026-04-07',
            label: 'Tuesday',
            details: 'Need extra recovery',
        })
    })

    it('preserves the session status prefix when notes are edited later', () => {
        const existing = buildRescheduledFromWorkoutSessionNote({
            sourceDateISO: '2026-04-06',
            sourceLabel: 'Monday',
            existingNotes: 'Old note',
        })

        const updated = buildWorkoutSessionNotesWithStatus(existing, 'Felt stronger than expected')

        expect(updated).toBe('[RESCHEDULED_FROM 2026-04-06|Monday] Felt stronger than expected')
        expect(parseWorkoutSessionStatus(updated)).toMatchObject({
            kind: 'rescheduled_from',
            dateISO: '2026-04-06',
            label: 'Monday',
            details: 'Felt stronger than expected',
        })
    })

    it('only excludes skipped sessions and reschedule placeholders from analytics', () => {
        const skipped = buildSkippedWorkoutSessionNote('Deload day')
        const rescheduledSource = buildRescheduledToWorkoutSessionNote({
            targetDateISO: '2026-04-07',
            targetLabel: 'Tuesday',
        })
        const rescheduledTarget = buildRescheduledFromWorkoutSessionNote({
            sourceDateISO: '2026-04-06',
            sourceLabel: 'Monday',
        })

        expect(isAnalyticsExcludedWorkoutSession(skipped)).toBe(true)
        expect(isAnalyticsExcludedWorkoutSession(rescheduledSource)).toBe(true)
        expect(isAnalyticsExcludedWorkoutSession(rescheduledTarget)).toBe(false)
        expect(removeSkippedWorkoutSessionNote(skipped)).toBe('Deload day')
    })
})
