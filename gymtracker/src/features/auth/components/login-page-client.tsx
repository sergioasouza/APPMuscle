'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
    requestPasswordResetAction,
    signInWithPasswordAction,
} from '@/features/auth/actions'

interface LoginPageClientProps {
    initialError?: string | null
}

export function LoginPageClient({ initialError = null }: LoginPageClientProps) {
    const t = useTranslations('Login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [resetting, setResetting] = useState(false)
    const [error, setError] = useState<string | null>(initialError)
    const [resetMessage, setResetMessage] = useState<string | null>(null)
    const router = useRouter()

    async function handleLogin(event: React.FormEvent) {
        event.preventDefault()
        setLoading(true)
        setError(null)
        setResetMessage(null)

        const result = await signInWithPasswordAction(email, password)

        if (!result.ok) {
            setError(result.message || t('loginError'))
            setLoading(false)
            return
        }

        router.push(result.data?.redirectTo ?? '/today')
        router.refresh()
    }

    async function handlePasswordReset() {
        if (!email.trim()) {
            setError(t('resetNeedsEmail'))
            return
        }

        setResetting(true)
        setError(null)
        setResetMessage(null)

        const result = await requestPasswordResetAction(email)

        if (!result.ok) {
            setError(result.message || t('resetError'))
            setResetting(false)
            return
        }

        setResetMessage(t('resetSent'))
        setResetting(false)
    }

    return (
        <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4">
                        <svg className="w-8 h-8 text-zinc-900 dark:text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{t('title')}</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{t('subtitle')}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>}
                    {resetMessage && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl">{resetMessage}</div>}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                            {t('email')}
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all text-base"
                            placeholder={t('emailPlaceholder')}
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                            {t('password')}
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            autoComplete="current-password"
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all text-base"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handlePasswordReset}
                            disabled={resetting}
                            className="text-sm text-violet-500 hover:text-violet-400 transition-colors disabled:opacity-60"
                        >
                            {resetting ? t('resetting') : t('forgotPassword')}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-zinc-900 dark:text-white font-semibold rounded-xl transition-all hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-base"
                    >
                        {loading ? (
                            <span className="inline-flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                {t('signingIn')}
                            </span>
                        ) : (
                            t('signIn')
                        )}
                    </button>
                </form>

                <div className="text-center text-zinc-600 dark:text-zinc-400 text-xs mt-8 space-y-2">
                    <p>{t('footer')}</p>
                    <p>{t('contactHint')}</p>
                </div>
            </div>
        </div>
    )
}
