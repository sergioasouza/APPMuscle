import { redirect } from 'next/navigation'
import { ToastProvider } from '@/components/ui/toast'
import { AdminNav } from '@/features/admin/components/admin-nav'
import {
    getOptionalAuthenticatedAppContext,
    isProfileAdmin,
    resolvePostAuthDestination,
} from '@/lib/access-control'

export const dynamic = 'force-dynamic'
export const metadata = {
    robots: {
        index: false,
        follow: false,
    },
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const context = await getOptionalAuthenticatedAppContext()

    if (!context.user || !context.profile) {
        redirect('/login')
    }

    if (context.profile.must_change_password) {
        redirect('/auth/change-password')
    }

    if (!isProfileAdmin(context.profile)) {
        redirect(resolvePostAuthDestination(context.profile, context.todayISO))
    }

    return (
        <ToastProvider>
            <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
                <AdminNav
                    displayName={context.profile.display_name}
                    email={context.user.email ?? null}
                />
                <main className="mx-auto w-full max-w-7xl px-4 py-6">
                    {children}
                </main>
            </div>
        </ToastProvider>
    )
}
