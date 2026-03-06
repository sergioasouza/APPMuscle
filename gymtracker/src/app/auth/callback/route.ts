import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInternalRedirect } from '@/lib/security'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = sanitizeInternalRedirect(searchParams.get('next'), '/today')

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Auth error — redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
