const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

export function isUuid(value: string): boolean {
  return uuidPattern.test(value)
}

export function assertUuid(value: string, fieldName: string) {
  if (!isUuid(value)) {
    throw new Error(`${fieldName} must be a valid UUID`)
  }
}

export function assertOptionalUuid(
  value: string | null | undefined,
  fieldName: string,
) {
  if (value == null || value === '') {
    return
  }

  assertUuid(value, fieldName)
}

export function assertIsoDate(value: string, fieldName: string) {
  if (
    !isoDatePattern.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    throw new Error(`${fieldName} must be a valid ISO date (YYYY-MM-DD)`)
  }
}

export function assertIntegerInRange(
  value: number,
  fieldName: string,
  min: number,
  max: number,
) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${fieldName} must be an integer between ${min} and ${max}`)
  }
}

export function assertPositiveInteger(
  value: number,
  fieldName: string,
  min = 1,
) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(
      `${fieldName} must be an integer greater than or equal to ${min}`,
    )
  }
}

export function assertFiniteNumber(
  value: number,
  fieldName: string,
  min?: number,
) {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`)
  }

  if (min != null && value < min) {
    throw new Error(`${fieldName} must be greater than or equal to ${min}`)
  }
}

export function assertStringArray(
  value: string[],
  fieldName: string,
  expectedLength?: number,
) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${fieldName} must be an array of strings`)
  }

  if (expectedLength != null && value.length !== expectedLength) {
    throw new Error(`${fieldName} must contain exactly ${expectedLength} items`)
  }
}
