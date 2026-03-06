import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
    getLocaleFromAcceptLanguage,
    isLocale,
    localeCookieName,
    localeCookieOptions,
} from '@/i18n/config'

function applyLocaleCookie(request: NextRequest, response: NextResponse) {
    const requestLocale = request.cookies.get(localeCookieName)?.value
    const locale = isLocale(requestLocale)
        ? requestLocale
        : getLocaleFromAcceptLanguage(request.headers.get('accept-language'))

    if (!isLocale(requestLocale)) {
        response.cookies.set(localeCookieName, locale, localeCookieOptions)
    }

    return locale
}

export async function updateSession(request: NextRequest) {
    // Skip during build if env vars not set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const response = NextResponse.next({ request })
        applyLocaleCookie(request, response)
        return response
    }

    let supabaseResponse = NextResponse.next({
        request,
    })

    applyLocaleCookie(request, supabaseResponse)

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                    applyLocaleCookie(request, supabaseResponse)
                },
            },
        }
    )

    // Refresh the session — this is critical for server components
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // If user is not signed in and trying to access protected routes, redirect to login
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/api/locale')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        const response = NextResponse.redirect(url)
        applyLocaleCookie(request, response)
        return response
    }

    // If user IS signed in and on the login page, redirect to /today
    if (user && request.nextUrl.pathname === '/login') {
        const url = request.nextUrl.clone()
        url.pathname = '/today'
        const response = NextResponse.redirect(url)
        applyLocaleCookie(request, response)
        return response
    }

    applyLocaleCookie(request, supabaseResponse)
    return supabaseResponse
}
