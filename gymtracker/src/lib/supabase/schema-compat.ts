interface SupabaseLikeError {
    message?: string
    details?: string
    hint?: string
    code?: string
}

function getErrorText(error: SupabaseLikeError | null | undefined) {
    return [error?.message, error?.details, error?.hint, error?.code]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' | ')
        .toLowerCase()
}

export function isMissingTableError(error: SupabaseLikeError | null | undefined, tableName: string) {
    const text = getErrorText(error)
    return text.includes(`could not find the table 'public.${tableName.toLowerCase()}'`)
        || text.includes(`relation "public.${tableName.toLowerCase()}" does not exist`)
}

export function isMissingColumnError(error: SupabaseLikeError | null | undefined, columnName: string) {
    const text = getErrorText(error)
    return text.includes(`could not find the column 'public.${columnName.toLowerCase()}'`)
        || text.includes(`column ${columnName.toLowerCase()} does not exist`)
        || text.includes(`column "public.${columnName.toLowerCase()}" does not exist`)
}

export function toMigrationRequiredError(featureName: string) {
    return new Error(`${featureName} requires the latest database migration to be applied`)
}
