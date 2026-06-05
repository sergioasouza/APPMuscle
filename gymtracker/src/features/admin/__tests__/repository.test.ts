import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '@/lib/types'

const mocks = vi.hoisted(() => ({
    getAdminServerContext: vi.fn(),
    getServiceRoleClient: vi.fn(),
    isServiceRoleConfigured: vi.fn(() => true),
    from: vi.fn(),
    listUsers: vi.fn(),
    deleteUser: vi.fn(),
}))

vi.mock('@/lib/supabase/auth', () => ({
    getAdminServerContext: mocks.getAdminServerContext,
}))

vi.mock('@/lib/supabase/service-role', () => ({
    getServiceRoleClient: mocks.getServiceRoleClient,
    isServiceRoleConfigured: mocks.isServiceRoleConfigured,
}))

import { listAdminUsersRepository } from '@/features/admin/repository'

function createProfile(overrides: Partial<Profile> = {}): Profile {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        display_name: 'Trial User',
        rotation_anchor_date: null,
        role: 'member',
        access_status: 'active',
        member_access_mode: 'trial',
        billing_day_of_month: null,
        billing_grace_business_days: 0,
        paid_until: null,
        trial_ends_at: '2026-04-05',
        must_change_password: false,
        created_by_admin_id: null,
        updated_at: '2026-04-01T00:00:00.000Z',
        created_at: '2026-04-01T00:00:00.000Z',
        ...overrides,
    }
}

describe('admin repository', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not initialize service role when the caller is not admin', async () => {
        mocks.getAdminServerContext.mockRejectedValueOnce(new Error('Forbidden'))

        await expect(
            listAdminUsersRepository({
                search: '',
                statusFilter: 'all',
                roleFilter: 'all',
                paymentFilter: 'all',
            }),
        ).rejects.toThrow('Forbidden')

        expect(mocks.getServiceRoleClient).not.toHaveBeenCalled()
    })

    it('does not delete expired trial users while reading admin users', async () => {
        const expiredTrialProfile = createProfile()
        const serviceRole = {
            from: mocks.from,
            auth: {
                admin: {
                    listUsers: mocks.listUsers,
                    deleteUser: mocks.deleteUser,
                },
            },
        }

        mocks.getAdminServerContext.mockResolvedValue({
            user: { id: '22222222-2222-4222-8222-222222222222' },
            profile: { display_name: 'Admin' },
            todayISO: '2026-04-06',
        })
        mocks.getServiceRoleClient.mockReturnValue(serviceRole)
        mocks.from.mockImplementation((table: string) => {
            if (table !== 'profiles') {
                throw new Error(`Unexpected table ${table}`)
            }

            return {
                select: vi.fn(() => ({
                    order: vi.fn().mockResolvedValue({
                        data: [expiredTrialProfile],
                        error: null,
                    }),
                })),
            }
        })
        mocks.listUsers.mockResolvedValue({
            data: {
                users: [
                    {
                        id: expiredTrialProfile.id,
                        email: 'trial@example.com',
                        created_at: expiredTrialProfile.created_at,
                        last_sign_in_at: null,
                    },
                ],
            },
            error: null,
        })

        const users = await listAdminUsersRepository({
            search: '',
            statusFilter: 'all',
            roleFilter: 'all',
            paymentFilter: 'all',
        })

        expect(users).toHaveLength(1)
        expect(users[0].memberAccessMode).toBe('trial')
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })
})
