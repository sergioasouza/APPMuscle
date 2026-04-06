import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
    getOptionalAuthenticatedAppContext,
    resolveBlockedReason,
    resolvePostAuthDestination,
} from '@/lib/access-control'

const whatsappUrl =
    process.env.NEXT_PUBLIC_CONTACT_WHATSAPP_URL ??
    'https://wa.me/5500000000000?text=Preciso%20regularizar%20meu%20acesso%20ao%20GymTracker'
const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'contato@gymtracker.app'

export const metadata = {
    robots: {
        index: false,
        follow: false,
    },
}

function getBlockedCopy(reason: ReturnType<typeof resolveBlockedReason>) {
    switch (reason) {
        case 'password_change_required':
            return {
                title: 'Sua conta precisa trocar a senha',
                description:
                    'Voce recebeu uma senha provisoria ou abriu um fluxo de recuperacao. Defina uma nova senha para continuar.',
                cta: {
                    href: '/auth/change-password',
                    label: 'Trocar senha agora',
                },
            }
        case 'payment_overdue':
            return {
                title: 'Seu acesso esta vencido',
                description:
                    'O uso do app fica bloqueado quando a renovacao do mes ainda nao foi confirmada.',
                cta: null,
            }
        case 'trial_expired':
            return {
                title: 'Seu periodo de teste terminou',
                description:
                    'O acesso de teste expirou. Se quiser continuar usando o app, fale com o suporte para liberar uma conta paga.',
                cta: null,
            }
        case 'manual_block':
        default:
            return {
                title: 'Seu acesso esta bloqueado',
                description:
                    'No momento esta conta esta sem liberacao para usar as areas internas do app.',
                cta: null,
            }
    }
}

export default async function BlockedPage() {
    const context = await getOptionalAuthenticatedAppContext()

    if (!context.profile) {
        redirect('/login')
    }

    const destination = resolvePostAuthDestination(context.profile, context.todayISO)

    if (destination !== '/blocked') {
        redirect(destination)
    }

    const reason = resolveBlockedReason(context.profile, context.todayISO)
    const copy = getBlockedCopy(reason)

    return (
        <main className="min-h-dvh bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
            <div className="mx-auto max-w-xl rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-500">
                    GymTracker
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                    {copy.title}
                </h1>
                <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    {copy.description}
                </p>

                <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                    <p>
                        <span className="font-semibold">Conta:</span>{' '}
                        {context.user?.email ?? 'sem e-mail'}
                    </p>
                    <p className="mt-2">
                        <span className="font-semibold">Acesso liberado ate:</span>{' '}
                        {context.profile.member_access_mode === 'trial'
                            ? context.profile.trial_ends_at ?? 'nao definido'
                            : context.profile.member_access_mode === 'billable'
                                ? context.profile.paid_until ?? 'nao definido'
                                : 'sem prazo'}
                    </p>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                    {copy.cta ? (
                        <Link
                            href={copy.cta.href}
                            className="rounded-xl bg-violet-600 px-4 py-3 text-center font-semibold text-white transition hover:bg-violet-500"
                        >
                            {copy.cta.label}
                        </Link>
                    ) : null}
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-zinc-200 px-4 py-3 text-center font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                    >
                        Falar no WhatsApp
                    </a>
                    <a
                        href={`mailto:${contactEmail}`}
                        className="rounded-xl border border-zinc-200 px-4 py-3 text-center font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                    >
                        {contactEmail}
                    </a>
                </div>
            </div>
        </main>
    )
}
