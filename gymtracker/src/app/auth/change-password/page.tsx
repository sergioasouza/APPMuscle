import { redirect } from 'next/navigation'
import { ChangePasswordPageClient } from '@/features/auth/components/change-password-page-client'
import { getOptionalAuthenticatedAppContext } from '@/lib/access-control'

export const metadata = {
    robots: {
        index: false,
        follow: false,
    },
}

export default async function ChangePasswordPage() {
    const context = await getOptionalAuthenticatedAppContext()

    if (!context.user) {
        redirect('/login')
    }

    return <ChangePasswordPageClient email={context.user.email ?? null} />
}
