'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FieldLabel, Input } from '@/components/ui/fields'
import { Surface, StatusPill } from '@/components/ui/surface'
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
        <div className="min-h-dvh px-4 py-10 sm:px-6">
            <div className="mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <Surface tone="accent" className="login-hero hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
                    <div>
                        <StatusPill className="bg-emerald-500/12 text-emerald-200">GymTracker Access</StatusPill>
                        <h1 className="mt-6 max-w-lg text-4xl font-black tracking-tight text-white">
                            {t('title')}
                        </h1>
                        <p className="mt-4 max-w-lg text-base leading-8 text-zinc-200">
                            {t('subtitle')}
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-5">
                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Hoje no app</p>
                            <div className="mt-4 space-y-3">
                                {['Treino do dia com séries e cardio', 'Agenda semanal com remarcação', 'Histórico, calendário e evolução'].map((item) => (
                                    <div key={item} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="text-sm leading-7 text-zinc-300">{t('contactHint')}</p>
                    </div>
                </Surface>

                <div className="flex items-center justify-center">
                    <Surface className="w-full max-w-md border-zinc-200 bg-white/95 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-zinc-950/90 sm:p-8">
                        <div className="mb-8 text-center">
                            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-gradient-to-br from-violet-600 to-indigo-500 shadow-[0_20px_50px_rgba(109,40,217,0.35)]">
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">{t('title')}</h2>
                            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{t('subtitle')}</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
                            {resetMessage && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{resetMessage}</div>}

                            <div>
                                    <FieldLabel htmlFor="email" className="text-zinc-700 dark:text-zinc-300">{t('email')}</FieldLabel>
                                    <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                        autoComplete="email"
                                        placeholder={t('emailPlaceholder')}
                                        className="border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                                    />
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <FieldLabel htmlFor="password" className="mb-0 text-zinc-700 dark:text-zinc-300">{t('password')}</FieldLabel>
                                    <button
                                        type="button"
                                        onClick={handlePasswordReset}
                                        disabled={resetting}
                                        className="rounded-lg px-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 transition-colors hover:text-violet-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 disabled:opacity-60 dark:text-violet-300 dark:hover:text-violet-200"
                                    >
                                        {resetting ? t('resetting') : t('forgotPassword')}
                                    </button>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className="border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                                />
                            </div>

                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {t('signingIn')}
                                    </span>
                                ) : (
                                    t('signIn')
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 space-y-2 text-center text-xs leading-6 text-zinc-600 dark:text-zinc-400">
                            <p>{t('footer')}</p>
                            <p>{t('contactHint')}</p>
                        </div>
                    </Surface>
                </div>
            </div>
        </div>
    )
}
