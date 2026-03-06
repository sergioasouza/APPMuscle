import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gymtracker.app'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'GymTracker',
    template: '%s • GymTracker',
  },
  description: 'Track your workouts, log your sets, see your progress.',
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
    title: 'GymTracker',
    description: 'Track your workouts, log your sets, and monitor your progress with a mobile-first training app.',
    siteName: 'GymTracker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GymTracker',
    description: 'Track your workouts, log your sets, and monitor your progress with a mobile-first training app.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
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
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
