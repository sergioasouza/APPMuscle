'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changePasswordAction } from '@/features/auth/actions'

interface ChangePasswordPageClientProps {
    email: string | null
}

export function ChangePasswordPageClient({
    email,
}: ChangePasswordPageClientProps) {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()

        if (password.length < 8) {
            setError('A senha precisa ter pelo menos 8 caracteres.')
            return
        }

        if (password !== confirmPassword) {
            setError('As senhas nao conferem.')
            return
        }

        setLoading(true)
        setError(null)

        const result = await changePasswordAction(password)

        if (!result.ok) {
            setError(result.message ?? 'Nao foi possivel atualizar sua senha agora.')
            setLoading(false)
            return
        }

        router.replace(result.data?.redirectTo ?? '/today')
        router.refresh()
    }

    return (
        <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
            <div className="w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-500">
                    Seguranca da conta
                </p>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Defina sua nova senha
                </h1>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    {email
                        ? `Conta: ${email}.`
                        : 'Atualize sua senha para continuar usando o GymTracker.'}{' '}
                    Se esta for uma senha provisoria enviada pelo admin, esta troca e obrigatoria.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    {error && (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
                        >
                            Nova senha
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="confirmPassword"
                            className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
                        >
                            Confirmar senha
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? 'Atualizando...' : 'Salvar nova senha'}
                    </button>
                </form>
            </div>
        </div>
    )
}
