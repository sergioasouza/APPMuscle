import { redirect } from 'next/navigation'
import {
    getOptionalAuthenticatedAppContext,
    isProfileAdmin,
    isProfileAccessActive,
} from '@/lib/access-control'
import { BottomNav } from '@/components/ui/bottom-nav'
import { ToastProvider } from '@/components/ui/toast'

export const dynamic = 'force-dynamic'
export const metadata = {
    robots: {
        index: false,
        follow: false,
    },
}

export default async function AppLayout({
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

    if (isProfileAdmin(context.profile)) {
        redirect('/admin')
    }

    if (!isProfileAccessActive(context.profile, context.todayISO)) {
        redirect('/blocked')
    }

    return (
        <ToastProvider>
            <div className="min-h-dvh pb-20">
                <main>{children}</main>
                <BottomNav />
            </div>
        </ToastProvider>
    )
}
