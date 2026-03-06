import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/ui/bottom-nav'
import { ToastProvider } from '@/components/ui/toast'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
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
