export default function RootLoading() {
    return (
        <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
            <div className="rounded-[2rem] border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-500">
                    GymTracker
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Carregando
                </h1>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Preparando a próxima tela...
                </p>
            </div>
        </main>
    )
}
