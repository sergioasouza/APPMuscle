import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gymtracker.app'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'Meta' })

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: 'GymTracker',
      template: '%s • GymTracker',
    },
    description: t('description'),
    applicationName: 'GymTracker',
    keywords: ['gym tracker', 'workout log', 'fitness', 'strength training', 'progressive overload'],
    category: 'fitness',
    manifest: '/manifest.json',
    icons: {
      icon: '/icon.svg',
      apple: '/apple-icon.svg',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'GymTracker',
    },
    openGraph: {
      type: 'website',
      url: siteUrl,
      title: t('ogTitle'),
      description: t('ogDescription'),
      siteName: 'GymTracker',
      locale: locale === 'pt' ? 'pt_BR' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edf4fc' },
    { media: '(prefers-color-scheme: dark)', color: '#02070e' },
  ],
}

import { ThemeProvider } from '@/components/theme-provider'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
