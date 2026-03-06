export interface ProfilePageData {
    email: string | null
    displayName: string | null
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
