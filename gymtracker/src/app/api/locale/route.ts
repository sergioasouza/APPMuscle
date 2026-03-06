import { NextResponse } from 'next/server'
import {
    isLocale,
    localeCookieName,
    localeCookieOptions,
} from '@/i18n/config'

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as { locale?: string } | null

    if (!body || !isLocale(body.locale)) {
        return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(localeCookieName, body.locale, localeCookieOptions)

    return response
}