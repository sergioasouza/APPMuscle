import { describe, expect, it } from 'vitest'
import { assertIsoDate } from '@/lib/validation'

describe('validation', () => {
    it('rejects ISO-looking dates that do not round-trip to a real date', () => {
        expect(() => assertIsoDate('2026-02-31', 'Date')).toThrow(
            'Date must be a valid ISO date',
        )
    })

    it('accepts real ISO calendar dates', () => {
        expect(() => assertIsoDate('2026-02-28', 'Date')).not.toThrow()
    })
})
