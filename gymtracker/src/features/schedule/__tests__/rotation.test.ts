import {
    buildScheduleDayPlan,
    buildScheduleVariants,
    getRotationCycleLength,
    resolveWeeklyRotationIndex,
} from '@/features/schedule/rotation'

function createWorkout(id: string, name: string) {
    return { id, name }
}

describe('buildScheduleVariants', () => {
    it('keeps the base schedule as rotation 1 and appends extra rotations in order', () => {
        const variants = buildScheduleVariants(
            {
                day_of_week: 1,
                workout_id: 'w1',
                workouts: createWorkout('w1', 'Push A'),
            },
            [
                {
                    id: 'r3',
                    day_of_week: 1,
                    rotation_index: 3,
                    workout_id: 'w3',
                    workouts: createWorkout('w3', 'Push C'),
                },
                {
                    id: 'r2',
                    day_of_week: 1,
                    rotation_index: 2,
                    workout_id: 'w2',
                    workouts: createWorkout('w2', 'Push B'),
                },
            ],
        )

        expect(variants.map((variant) => `${variant.rotationIndex}:${variant.workout.name}`)).toEqual([
            '1:Push A',
            '2:Push B',
            '3:Push C',
        ])
    })
})

describe('resolveWeeklyRotationIndex', () => {
    it('defaults to rotation 1 when no anchor date exists', () => {
        expect(resolveWeeklyRotationIndex('2026-04-02', null, 3)).toBe(1)
    })

    it('cycles through the available variants week by week', () => {
        expect(resolveWeeklyRotationIndex('2026-04-02', '2026-04-02', 3)).toBe(1)
        expect(resolveWeeklyRotationIndex('2026-04-09', '2026-04-02', 3)).toBe(2)
        expect(resolveWeeklyRotationIndex('2026-04-16', '2026-04-02', 3)).toBe(3)
        expect(resolveWeeklyRotationIndex('2026-04-23', '2026-04-02', 3)).toBe(1)
    })

    it('wraps correctly for dates before the anchor', () => {
        expect(resolveWeeklyRotationIndex('2026-03-26', '2026-04-02', 2)).toBe(2)
    })
})

describe('getRotationCycleLength', () => {
    it('returns 1 when there are no extra rotations', () => {
        expect(getRotationCycleLength([])).toBe(1)
    })

    it('uses the highest configured rotation index as the cycle length', () => {
        expect(
            getRotationCycleLength([
                {
                    id: 'r2',
                    day_of_week: 1,
                    rotation_index: 2,
                    workout_id: 'w2',
                    workouts: createWorkout('w2', 'Push B'),
                },
                {
                    id: 'r3',
                    day_of_week: 4,
                    rotation_index: 3,
                    workout_id: 'w3',
                    workouts: createWorkout('w3', 'Legs C'),
                },
            ]),
        ).toBe(3)
    })
})

describe('buildScheduleDayPlan', () => {
    it('returns the active workout for the current rotation week', () => {
        const dayPlan = buildScheduleDayPlan({
            dayOfWeek: 1,
            dateISO: '2026-04-09',
            anchorDateISO: '2026-04-02',
            baseEntry: {
                day_of_week: 1,
                workout_id: 'w1',
                workouts: createWorkout('w1', 'Push A'),
            },
            extraRotations: [
                {
                    id: 'r2',
                    day_of_week: 1,
                    rotation_index: 2,
                    workout_id: 'w2',
                    workouts: createWorkout('w2', 'Push B'),
                },
            ],
        })

        expect(dayPlan.activeRotationIndex).toBe(2)
        expect(dayPlan.activeVariant?.workout.name).toBe('Push B')
    })

    it('returns an empty day plan when no variants are configured', () => {
        const dayPlan = buildScheduleDayPlan({
            dayOfWeek: 3,
            dateISO: '2026-04-09',
            anchorDateISO: '2026-04-02',
            baseEntry: null,
            extraRotations: [],
            cycleLength: 2,
        })

        expect(dayPlan.activeRotationIndex).toBe(2)
        expect(dayPlan.activeVariant).toBeNull()
        expect(dayPlan.variants).toHaveLength(0)
    })

    it('falls back to week 1 when a later week has no custom workout for that day', () => {
        const dayPlan = buildScheduleDayPlan({
            dayOfWeek: 4,
            dateISO: '2026-04-09',
            anchorDateISO: '2026-04-02',
            baseEntry: {
                day_of_week: 4,
                workout_id: 'w1',
                workouts: createWorkout('w1', 'Legs A'),
            },
            extraRotations: [],
            cycleLength: 2,
        })

        expect(dayPlan.activeRotationIndex).toBe(2)
        expect(dayPlan.activeVariant?.workout.name).toBe('Legs A')
    })
})
