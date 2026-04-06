import { describe, expect, it } from 'vitest'
import {
    isProfileAccessActive,
    resolveBlockedReason,
    resolvePostAuthDestination,
    type AppProfileAccess,
} from '@/lib/access-control'

function createProfile(
    overrides: Partial<AppProfileAccess> = {},
): AppProfileAccess {
    return {
        id: 'profile-1',
        display_name: 'Test User',
        rotation_anchor_date: null,
        created_at: '2026-01-01T00:00:00.000Z',
        role: 'member',
        access_status: 'active',
        member_access_mode: 'billable',
        billing_day_of_month: 5,
        billing_grace_business_days: 2,
        paid_until: '2026-04-30',
        trial_ends_at: null,
        must_change_password: false,
        created_by_admin_id: null,
        updated_at: '2026-04-01T00:00:00.000Z',
        ...overrides,
    }
}

describe('access control', () => {
    it('treats paid active members as active', () => {
        expect(isProfileAccessActive(createProfile(), '2026-04-06')).toBe(true)
    })

    it('blocks overdue members', () => {
        expect(
            isProfileAccessActive(
                createProfile({ paid_until: '2026-04-05' }),
                '2026-04-06',
            ),
        ).toBe(false)
    })

    it('always allows admins', () => {
        expect(
            isProfileAccessActive(
                createProfile({
                    role: 'admin',
                    access_status: 'blocked',
                    member_access_mode: 'internal',
                    paid_until: null,
                }),
                '2026-04-06',
            ),
        ).toBe(true)
    })

    it('routes admins to the backoffice', () => {
        expect(
            resolvePostAuthDestination(
                createProfile({
                    role: 'admin',
                    member_access_mode: 'internal',
                    paid_until: null,
                }),
                '2026-04-06',
            ),
        ).toBe('/admin')
    })

    it('forces password change before everything else', () => {
        expect(
            resolvePostAuthDestination(
                createProfile({ must_change_password: true }),
                '2026-04-06',
            ),
        ).toBe('/auth/change-password')
        expect(
            resolveBlockedReason(
                createProfile({ must_change_password: true }),
                '2026-04-06',
            ),
        ).toBe('password_change_required')
    })

    it('routes overdue members to blocked', () => {
        expect(
            resolvePostAuthDestination(
                createProfile({ paid_until: '2026-04-05' }),
                '2026-04-06',
            ),
        ).toBe('/blocked')
        expect(
            resolveBlockedReason(
                createProfile({ paid_until: '2026-04-05' }),
                '2026-04-06',
            ),
        ).toBe('payment_overdue')
    })

    it('allows internal members without payment date', () => {
        expect(
            isProfileAccessActive(
                createProfile({
                    member_access_mode: 'internal',
                    paid_until: null,
                }),
                '2026-04-06',
            ),
        ).toBe(true)
    })

    it('blocks expired trial members', () => {
        expect(
            resolveBlockedReason(
                createProfile({
                    member_access_mode: 'trial',
                    paid_until: null,
                    trial_ends_at: '2026-04-05',
                }),
                '2026-04-06',
            ),
        ).toBe('trial_expired')
    })
})
