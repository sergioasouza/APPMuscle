export function getDayOfWeek(date: Date = new Date()): number {
    return date.getDay()
}

export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export function formatDateISO(date: Date): string {
    return date.toISOString().split('T')[0]
}

export function getLocalizedWeekdayNames(
    locale: string,
    format: 'long' | 'short' = 'long'
): string[] {
    const formatter = new Intl.DateTimeFormat(locale, {
        weekday: format,
        timeZone: 'UTC',
    })
    const firstSunday = new Date(Date.UTC(2024, 0, 7))

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(firstSunday)
        date.setUTCDate(firstSunday.getUTCDate() + index)
        return formatter.format(date)
    })
}

export function formatMonthYear(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
    }).format(date)
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ')
}
