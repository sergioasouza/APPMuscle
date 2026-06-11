import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  getOptionalAuthenticatedAppContext,
  resolvePostAuthDestination,
} from '@/lib/access-control'
import { getLandingPublicContact } from '@/lib/public-contact'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const t = await getTranslations('Landing')
  const context = await getOptionalAuthenticatedAppContext()
  const { whatsappUrl, contactEmail } = getLandingPublicContact()

  if (context.profile) {
    redirect(resolvePostAuthDestination(context.profile, context.todayISO))
  }

  return (
    <main className="dark min-h-dvh bg-[#02070e] text-white">
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 pb-16 pt-8 sm:px-10 lg:px-12">
        <header className="app-panel flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <p className="app-kicker text-blue-200">{t('eyebrow')}</p>
            <p className="mt-2 max-w-xl text-sm text-zinc-300">
              {t('headerSummary')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-blue-400/60 hover:bg-white/8"
            >
              {t('whatsappCta')}
            </a>
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(2,132,199,0.35)] transition hover:from-blue-500 hover:to-cyan-400"
            >
              {t('signIn')}
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              {t('badge')}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              {t('description')}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                {t('primaryCta')}
              </a>
              <a
                href={`mailto:${contactEmail}`}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/60 hover:bg-white/5"
              >
                {contactEmail}
              </a>
            </div>

            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="app-panel-muted rounded-3xl border border-white/10 p-5">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {t('statOneLabel')}
                </dt>
                <dd className="mt-3 text-2xl font-bold text-white">
                  {t('statOneValue')}
                </dd>
              </div>
              <div className="app-panel-muted rounded-3xl border border-white/10 p-5">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {t('statTwoLabel')}
                </dt>
                <dd className="mt-3 text-2xl font-bold text-white">
                  {t('statTwoValue')}
                </dd>
              </div>
              <div className="app-panel-muted rounded-3xl border border-white/10 p-5">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {t('statThreeLabel')}
                </dt>
                <dd className="mt-3 text-2xl font-bold text-white">
                  {t('statThreeValue')}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-4">
            <div className="app-panel app-panel-accent rounded-[2rem] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-300">
                    {t('todayCardLabel')}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    {t('todayCardTitle')}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  {t('todayCardBadge')}
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  t('todayItemOne'),
                  t('todayItemTwo'),
                  t('todayItemThree'),
                  t('todayItemFour'),
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-zinc-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="app-panel-muted rounded-[2rem] border border-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {t('miniCardOneLabel')}
                </p>
                <p className="mt-3 text-3xl font-bold text-white">{t('miniCardOneValue')}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {t('miniCardOneDescription')}
                </p>
              </div>
              <div className="app-panel-muted rounded-[2rem] border border-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {t('miniCardTwoLabel')}
                </p>
                <p className="mt-3 text-3xl font-bold text-white">{t('miniCardTwoValue')}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {t('miniCardTwoDescription')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="app-panel grid gap-4 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {t('faqLabel')}
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('faqOneTitle')}
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  {t('faqOneAnswer')}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('faqTwoTitle')}
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  {t('faqTwoAnswer')}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('faqThreeTitle')}
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  {t('faqThreeAnswer')}
                </p>
              </div>
            </div>
          </div>

          <div className="app-panel-accent rounded-[1.75rem] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-200/80">
              {t('ctaLabel')}
            </p>
            <h3 className="mt-3 text-2xl font-bold text-white">
              {t('ctaTitle')}
            </h3>
            <p className="mt-3 text-sm leading-7 text-blue-100/85">
              {t('ctaDescription')}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                {t('ctaPrimary')}
              </a>
              <Link
                href="/login"
                className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5"
              >
                {t('ctaSecondary')}
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-zinc-400">
          <p>GymTracker</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition hover:text-white">
              {t('privacy')}
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              {t('terms')}
            </Link>
            <Link href="/login" className="transition hover:text-white">
              {t('footerLogin')}
            </Link>
          </div>
        </footer>
      </section>
    </main>
  )
}
