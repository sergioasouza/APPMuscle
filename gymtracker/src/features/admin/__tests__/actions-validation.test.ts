import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
    archiveAdminSystemExercise: vi.fn(),
    createAdminSystemExercise: vi.fn(),
    createAdminUser: vi.fn(),
    deleteAdminUser: vi.fn(),
    recordManualBillingEvent: vi.fn(),
    resetAdminUserTemporaryPassword: vi.fn(),
    unarchiveAdminSystemExercise: vi.fn(),
    updateAdminSystemExercise: vi.fn(),
    updateAdminUser: vi.fn(),
}))

vi.mock('@/features/admin/service', () => serviceMocks)

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

import {
    deleteAdminUserAction,
    recordManualBillingEventAction,
} from '@/features/admin/actions'

describe('admin action validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects invalid user ids before admin user deletion service calls', async () => {
        const result = await deleteAdminUserAction('not-a-uuid')

        expect(result.ok).toBe(false)
        expect(result.message).toContain('User id must be a valid UUID')
        expect(serviceMocks.deleteAdminUser).not.toHaveBeenCalled()
    })

    it('rejects invalid billing target ids before recording payment', async () => {
        const result = await recordManualBillingEventAction('not-a-uuid', {
            referenceMonth: '2026-04-01',
            status: 'paid',
            note: null,
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('User id must be a valid UUID')
        expect(serviceMocks.recordManualBillingEvent).not.toHaveBeenCalled()
    })
})
