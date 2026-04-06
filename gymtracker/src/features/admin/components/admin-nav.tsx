'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOutAction } from '@/features/auth/actions'
import { useToast } from '@/components/ui/toast'

interface AdminNavProps {
    displayName: string
    email: string | null
}

const links = [
    { href: '/admin', label: 'Visão geral' },
    { href: '/admin/users', label: 'Usuários' },
    { href: '/admin/exercises', label: 'Exercícios base' },
] as const

export function AdminNav({ displayName, email }: AdminNavProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { showToast } = useToast()

    async function handleSignOut() {
        const result = await signOutAction()

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível sair agora.', 'error')
            return
        }

        router.replace('/login')
        router.refresh()
    }

    return (
        <header className="border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">
                        GymTracker Admin
                    </p>
                    <h1 className="mt-2 truncate text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                        {displayName}
                    </h1>
                    <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {email ?? 'Conta administrativa'}
                    </p>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                    <nav
                        aria-label="Navegação administrativa"
                        className="flex flex-wrap items-center gap-2"
                    >
                        {links.map((link) => {
                            const isActive =
                                pathname === link.href || pathname.startsWith(`${link.href}/`)

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            )
                        })}
                    </nav>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                        Sair
                    </button>
                </div>
            </div>
        </header>
    )
}
