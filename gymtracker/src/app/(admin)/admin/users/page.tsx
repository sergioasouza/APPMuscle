import { AdminUsersPageClient } from '@/features/admin/components/admin-users-page-client'
import { listAdminUsers } from '@/features/admin/service'
import type { AdminUserListQuery } from '@/features/admin/types'

interface AdminUsersPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getSingleValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

function parseQuery(input: Record<string, string | string[] | undefined> | undefined): AdminUserListQuery {
    const status = getSingleValue(input?.status)
    const role = getSingleValue(input?.role)
    const payment = getSingleValue(input?.payment)

    return {
        search: getSingleValue(input?.search)?.trim() ?? '',
        statusFilter: status === 'active' || status === 'blocked' ? status : 'all',
        roleFilter: role === 'member' || role === 'admin' ? role : 'all',
        paymentFilter: payment === 'paid' || payment === 'overdue' ? payment : 'all',
    }
}

export const metadata = {
    title: 'Admin • Usuários',
}

export default async function AdminUsersPage({
    searchParams,
}: AdminUsersPageProps) {
    const resolvedSearchParams = await searchParams
    const query = parseQuery(resolvedSearchParams)
    const users = await listAdminUsers(query)

    return (
        <AdminUsersPageClient
            initialUsers={users}
            initialQuery={query}
        />
    )
}
