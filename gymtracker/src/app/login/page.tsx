import { redirect } from 'next/navigation'
import { LoginPageClient } from '@/features/auth/components/login-page-client'
import {
    getOptionalAuthenticatedAppContext,
    resolvePostAuthDestination,
} from '@/lib/access-control'

export const metadata = {
    robots: {
        index: false,
        follow: false,
    },
}

interface LoginPageProps {
    searchParams?: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const [context, resolvedSearchParams] = await Promise.all([
        getOptionalAuthenticatedAppContext(),
        searchParams,
    ])

    if (context.profile) {
        redirect(resolvePostAuthDestination(context.profile, context.todayISO))
    }

    const initialError =
        resolvedSearchParams?.error === 'auth_error'
            ? 'Não foi possível concluir a autenticação.'
            : null

    return <LoginPageClient initialError={initialError} />
}
