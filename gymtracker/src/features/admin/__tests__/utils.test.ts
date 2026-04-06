import { describe, expect, it } from 'vitest'
import {
    getCurrentReferenceMonth,
    getEndOfMonthISO,
    getEndOfPreviousMonthISO,
    getReferenceMonthFromInput,
    maxDateISO,
    slugifySystemExerciseKey,
} from '@/features/admin/utils'

describe('admin utils', () => {
    it('normalizes any day into the first day of the reference month', () => {
        expect(getReferenceMonthFromInput('2026-04-18')).toBe('2026-04-01')
    })

    it('resolves end-of-month helpers', () => {
        expect(getEndOfMonthISO('2026-02-01')).toBe('2026-02-28')
        expect(getEndOfPreviousMonthISO('2026-04-01')).toBe('2026-03-31')
    })

    it('returns the current month reference in YYYY-MM-01 format', () => {
        expect(getCurrentReferenceMonth()).toMatch(/^\d{4}-\d{2}-01$/)
    })

    it('gets the greatest date ignoring nulls', () => {
        expect(maxDateISO('2026-04-05', '2026-04-06')).toBe('2026-04-06')
        expect(maxDateISO(null, '2026-04-06')).toBe('2026-04-06')
    })

    it('creates readable system keys from exercise metadata', () => {
        expect(
            slugifySystemExerciseKey({
                name: 'Supino Reto',
                modality: 'Barra Livre',
            }),
        ).toBe('supino-reto-barra-livre')
    })
})
