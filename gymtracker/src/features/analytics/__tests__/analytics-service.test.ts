import {
  buildEvolution,
  buildSummary,
  estimated1RM,
  findBestSet,
} from '@/features/analytics/service'
import type { SetLog, WorkoutSession } from '@/lib/types'

function createSession(
  id: string,
  performedAt: string,
  workoutId = '11111111-1111-4111-8111-111111111111',
): WorkoutSession {
  return {
    id,
    user_id: '22222222-2222-4222-8222-222222222222',
    workout_id: workoutId,
    performed_at: performedAt,
    notes: null,
    created_at: `${performedAt}T08:00:00.000Z`,
  }
}

function createSetLog(input: {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  weight: number
  reps: number
}): SetLog {
  return {
    id: input.id,
    session_id: input.sessionId,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    weight_kg: input.weight,
    reps: input.reps,
    created_at: '2026-03-01T08:00:00.000Z',
  }
}

describe('estimated1RM', () => {
  it('returns 0 for non-positive weight or reps', () => {
    expect(estimated1RM(0, 10)).toBe(0)
    expect(estimated1RM(100, 0)).toBe(0)
    expect(estimated1RM(-10, 8)).toBe(0)
  })

  it('returns the weight itself for a single rep', () => {
    expect(estimated1RM(100, 1)).toBe(100)
  })

  it('calculates the Epley estimate rounded to one decimal place', () => {
    expect(estimated1RM(100, 5)).toBe(116.7)
  })
})

describe('findBestSet', () => {
  const exerciseId = '33333333-3333-4333-8333-333333333333'
  const otherExerciseId = '44444444-4444-4444-8444-444444444444'

  it('returns null when there are no valid sets for the exercise in the session', () => {
    const result = findBestSet(
      [
        createSetLog({
          id: '1',
          sessionId: 'session-1',
          exerciseId: otherExerciseId,
          setNumber: 1,
          weight: 80,
          reps: 8,
        }),
      ],
      'session-1',
      exerciseId,
    )

    expect(result).toBeNull()
  })

  it('ignores invalid sets and picks the best set by estimated 1RM', () => {
    const result = findBestSet(
      [
        createSetLog({
          id: '1',
          sessionId: 'session-1',
          exerciseId,
          setNumber: 1,
          weight: 0,
          reps: 10,
        }),
        createSetLog({
          id: '2',
          sessionId: 'session-1',
          exerciseId,
          setNumber: 2,
          weight: 100,
          reps: 5,
        }),
        createSetLog({
          id: '3',
          sessionId: 'session-1',
          exerciseId,
          setNumber: 3,
          weight: 105,
          reps: 3,
        }),
      ],
      'session-1',
      exerciseId,
    )

    expect(result?.id).toBe('2')
  })
})

describe('buildEvolution', () => {
  const exerciseId = '33333333-3333-4333-8333-333333333333'

  it('returns points ordered chronologically and skips sessions without valid sets', () => {
    const sessions = [
      createSession('session-2', '2026-03-12'),
      createSession('session-1', '2026-03-05'),
      createSession('session-3', '2026-03-18'),
    ]

    const setLogs = [
      createSetLog({
        id: '1',
        sessionId: 'session-2',
        exerciseId,
        setNumber: 1,
        weight: 105,
        reps: 5,
      }),
      createSetLog({
        id: '2',
        sessionId: 'session-1',
        exerciseId,
        setNumber: 1,
        weight: 100,
        reps: 5,
      }),
      createSetLog({
        id: '3',
        sessionId: 'session-3',
        exerciseId,
        setNumber: 1,
        weight: 0,
        reps: 0,
      }),
    ]

    expect(buildEvolution(sessions, setLogs, exerciseId)).toEqual([
      {
        date: '2026-03-05',
        weight: 100,
        reps: 5,
        estimated1RM: 116.7,
      },
      {
        date: '2026-03-12',
        weight: 105,
        reps: 5,
        estimated1RM: 122.5,
      },
    ])
  })
})

describe('buildSummary', () => {
  it('returns null for an empty evolution curve', () => {
    expect(buildSummary([])).toBeNull()
  })

  it('marks the trend as up when recent sessions improve enough', () => {
    const points = [
      { date: '2026-03-01', weight: 90, reps: 5, estimated1RM: 105 },
      { date: '2026-03-05', weight: 92.5, reps: 5, estimated1RM: 108 },
      { date: '2026-03-09', weight: 95, reps: 5, estimated1RM: 111 },
      { date: '2026-03-13', weight: 100, reps: 5, estimated1RM: 116 },
      { date: '2026-03-17', weight: 102.5, reps: 5, estimated1RM: 119 },
      { date: '2026-03-21', weight: 105, reps: 5, estimated1RM: 122 },
    ]

    const summary = buildSummary(points)

    expect(summary?.trend).toBe('up')
    expect(summary?.prEstimated1RM).toBe(122)
    expect(summary?.lastDate).toBe('2026-03-21')
  })

  it('marks the trend as down when recent sessions regress enough', () => {
    const points = [
      { date: '2026-03-01', weight: 105, reps: 5, estimated1RM: 122 },
      { date: '2026-03-05', weight: 102.5, reps: 5, estimated1RM: 119 },
      { date: '2026-03-09', weight: 100, reps: 5, estimated1RM: 116 },
      { date: '2026-03-13', weight: 95, reps: 5, estimated1RM: 111 },
      { date: '2026-03-17', weight: 92.5, reps: 5, estimated1RM: 108 },
      { date: '2026-03-21', weight: 90, reps: 5, estimated1RM: 105 },
    ]

    expect(buildSummary(points)?.trend).toBe('down')
  })

  it('marks the trend as stable when the change stays within the 2 percent threshold', () => {
    const points = [
      { date: '2026-03-01', weight: 100, reps: 5, estimated1RM: 116 },
      { date: '2026-03-05', weight: 100, reps: 5, estimated1RM: 116.5 },
      { date: '2026-03-09', weight: 100, reps: 5, estimated1RM: 117 },
      { date: '2026-03-13', weight: 100, reps: 5, estimated1RM: 117.2 },
      { date: '2026-03-17', weight: 100, reps: 5, estimated1RM: 117.4 },
      { date: '2026-03-21', weight: 100, reps: 5, estimated1RM: 117.6 },
    ]

    expect(buildSummary(points)?.trend).toBe('stable')
  })

  it('falls back to comparing first and last session when there are fewer than four points', () => {
    const points = [
      { date: '2026-03-01', weight: 90, reps: 5, estimated1RM: 105 },
      { date: '2026-03-05', weight: 92.5, reps: 5, estimated1RM: 108 },
      { date: '2026-03-09', weight: 95, reps: 5, estimated1RM: 111 },
    ]

    expect(buildSummary(points)?.trend).toBe('up')
  })
})
