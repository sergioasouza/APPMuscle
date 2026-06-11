'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { bottomNavItems } from '@/components/ui/bottom-nav-items'

export function BottomNav() {
    const pathname = usePathname()
    const t = useTranslations('Nav')

    return (
        <nav aria-label={t('mainNavigation')} className="fixed bottom-3 left-0 right-0 z-40 px-2 sm:bottom-4 sm:px-6">
            <div className="app-panel mx-auto grid max-w-2xl grid-cols-6 items-stretch gap-1 px-1 pb-safe sm:gap-2 sm:px-2">
                {bottomNavItems.map((tab) => {
                    const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
                    const Icon = tab.icon

                    return (
                        <Link
                            key={tab.key}
                            href={tab.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 pb-2 pt-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25 sm:px-3',
                                isActive
                                    ? 'text-sky-600 drop-shadow-[0_0_14px_rgba(14,165,233,0.35)] dark:text-cyan-300'
                                    : 'text-slate-500 dark:text-slate-400 active:text-slate-300'
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
                            <span className="max-w-full truncate text-[9px] font-semibold uppercase tracking-[0.08em] sm:text-[10px] sm:tracking-[0.14em]">{t(tab.key)}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
