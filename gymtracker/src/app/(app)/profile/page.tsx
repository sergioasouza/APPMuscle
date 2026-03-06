'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSupabase } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { useToast } from '@/components/ui/toast'
import type { AppLocale } from '@/i18n/config'
import type { User } from '@supabase/supabase-js'

export default function ProfilePage() {
    const router = useRouter()
    const supabase = useSupabase()
    const { theme, setTheme } = useTheme()
    const t = useTranslations()
    const locale = useLocale() as AppLocale
    const { showToast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<{ display_name: string } | null>(null)
    const [loading, setLoading] = useState(true)
    const [updatingLocale, setUpdatingLocale] = useState(false)

    // Ensure hydration mismatch doesn't happen with next-themes
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', user.id)
                    .single()
                setProfile(data)
            }
            setLoading(false)
        }
        fetchUser()
    }, [supabase])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.refresh()
    }

    const handleLanguageChange = async (nextLocale: AppLocale) => {
        if (nextLocale === locale) {
            return
        }

        try {
            setUpdatingLocale(true)

            const response = await fetch('/api/locale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ locale: nextLocale }),
            })

            if (!response.ok) {
                throw new Error('Unable to update locale')
            }

            router.refresh()
        } catch {
            showToast(t('Profile.languageUpdateError'), 'error')
        } finally {
            setUpdatingLocale(false)
        }
    }

    if (loading) {
        return (
            <div className="px-4 pt-6 space-y-6 animate-pulse">
                <div className="h-24 bg-white dark:bg-zinc-900 shadow-xl shadow-black/20 rounded-2xl" />
                <div className="h-48 bg-white dark:bg-zinc-900 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">{t('Profile.title')}</h1>

            {/* Profile Header */}
            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 p-6 rounded-2xl flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center text-2xl font-bold border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                    {profile?.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
                        {profile?.display_name || 'Athlete'}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{user?.email}</p>
                </div>
            </div>

            {/* Application Settings Group */}
            <div className="mb-8">
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 px-1">{t('Profile.settings')}</h3>
                <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">

                    {/* Theme Toggle */}
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                                {mounted && theme === 'dark' ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{t('Profile.appTheme')}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Profile.appThemeDesc')}</p>
                            </div>
                        </div>
                        {mounted && (
                            <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white rounded-lg py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            >
                                <option value="system">{t('Profile.themeSystem')}</option>
                                <option value="dark">{t('Profile.themeDark')}</option>
                                <option value="light">{t('Profile.themeLight')}</option>
                            </select>
                        )}
                    </div>

                    {/* Language Settings */}
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{t('Profile.language')}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Profile.languageDesc')}</p>
                            </div>
                        </div>
                        <select
                            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white rounded-lg py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            value={locale}
                            onChange={(e) => handleLanguageChange(e.target.value as AppLocale)}
                            disabled={updatingLocale}
                        >
                            <option value="en">{t('Profile.languageEnglish')}</option>
                            <option value="pt">{t('Profile.languagePortuguese')}</option>
                        </select>
                    </div>

                    {/* References Placeholders */}
                    <div className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{t('Profile.version')}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">GymTracker v1.0.0 (Beta)</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Danger Zone */}
            <div>
                <h3 className="text-xs font-semibold text-red-500/80 uppercase tracking-wider mb-3 px-1">{t('Profile.account')}</h3>
                <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden p-2">
                    <button
                        onClick={handleSignOut}
                        className="w-full flex justify-between items-center px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold rounded-xl transition-colors"
                    >
                        <span>{t('Profile.signOut')}</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                    </button>
                </div>
            </div>

        </div>
    )
}
