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
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-50 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800/50">
            <div className="flex items-center justify-around max-w-lg mx-auto pb-safe">
                {bottomNavItems.map((tab) => {
                    const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
                    const Icon = tab.icon

                    return (
                        <Link
                            key={tab.key}
                            href={tab.href}
                            className={cn(
                                'flex flex-col items-center gap-0.5 pt-2 pb-1 px-3 min-w-[4rem] transition-colors',
                                isActive
                                    ? 'text-violet-400'
                                    : 'text-zinc-500 dark:text-zinc-400 active:text-zinc-300'
                            )}
                        >
                            <Icon className="h-5 w-5" strokeWidth={2} />
                            <span className="text-[10px] font-medium">{t(tab.key)}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
