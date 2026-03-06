export function sanitizeInternalRedirect(target: string | null | undefined, fallback = '/today') {
    if (!target || !target.startsWith('/') || target.startsWith('//')) {
        return fallback
    }

    return target
}

export function isTrustedOriginRequest(request: Request) {
    const requestOrigin = new URL(request.url).origin
    const originHeader = request.headers.get('origin')
    const refererHeader = request.headers.get('referer')

    if (originHeader) {
        return originHeader === requestOrigin
    }

    if (refererHeader) {
        try {
            return new URL(refererHeader).origin === requestOrigin
        } catch {
            return false
        }
    }

    return true
}
