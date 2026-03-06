export const locales = ['en', 'pt'] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'en'
export const localeCookieName = 'gymtracker_locale'

export const localeCookieOptions = {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax' as const,
}

export function isLocale(value: string | null | undefined): value is AppLocale {
    return locales.includes(value as AppLocale)
}

export function getLocaleFromAcceptLanguage(headerValue: string | null): AppLocale {
    if (!headerValue) {
        return defaultLocale
    }

    const requestedLocales = headerValue
        .split(',')
        .map((part) => part.trim().split(';')[0]?.toLowerCase())
        .filter(Boolean)

    const matchedLocale = requestedLocales.find((candidate) =>
        locales.some((locale) => candidate === locale || candidate?.startsWith(`${locale}-`))
    )

    return matchedLocale?.startsWith('pt') ? 'pt' : defaultLocale
}

export async function getMessagesForLocale(locale: AppLocale) {
    switch (locale) {
        case 'pt':
            return (await import('@/messages/pt.json')).default
        case 'en':
        default:
            return (await import('@/messages/en.json')).default
    }
}