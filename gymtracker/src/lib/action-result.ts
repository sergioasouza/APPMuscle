export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}

export function toErrorMessage(error: unknown, fallback = 'Unexpected error') {
    return error instanceof Error ? error.message : fallback
}

export function okResult<T>(data: T): ActionResult<T> {
    return { ok: true, data }
}

export function errorResult<T>(error: unknown, fallback = 'Unexpected error'): ActionResult<T> {
    return { ok: false, message: toErrorMessage(error, fallback) }
}
