'use client'

export default function RootError({
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
            <div className="max-w-md rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm uppercase tracking-[0.25em] text-red-500">
                    Erro
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Não foi possível carregar esta página
                </h1>
                <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    Tente novamente. Se o problema continuar, vale revisar logs do app e do Supabase.
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="mt-6 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                    Tentar de novo
                </button>
            </div>
        </main>
    )
}
