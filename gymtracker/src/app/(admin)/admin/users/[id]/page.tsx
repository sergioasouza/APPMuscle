import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminUserDetailPageClient } from '@/features/admin/components/admin-user-detail-page-client'
import { getAdminUserDetail } from '@/features/admin/service'
import { getCurrentReferenceMonth } from '@/features/admin/utils'

interface AdminUserDetailPageProps {
    params: Promise<{ id: string }>
}

export const metadata = {
    title: 'Admin • Detalhe do usuário',
}

export default async function AdminUserDetailPage({
    params,
}: AdminUserDetailPageProps) {
    const { id } = await params
    const detail = await getAdminUserDetail(id)

    if (!detail) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 transition hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-300"
            >
                Voltar para usuários
            </Link>
            <AdminUserDetailPageClient
                detail={detail}
                currentReferenceMonth={getCurrentReferenceMonth()}
            />
        </div>
    )
}
