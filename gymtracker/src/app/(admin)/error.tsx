'use client'

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const isServiceRoleError = error.message.includes('Admin service role is not configured')

    return (
        <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
            <div className="max-w-md rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm uppercase tracking-[0.25em] text-red-500">
                    Backoffice
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    O painel admin encontrou um erro
                </h1>
                <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {isServiceRoleError
                        ? 'Configure SUPABASE_SERVICE_ROLE_KEY em Production na Vercel e faça um novo deploy.'
                        : 'Revise a operação e tente novamente. Se persistir, consulte o log administrativo.'}
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="mt-6 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                    Tentar novamente
                </button>
            </div>
        </main>
    )
}
