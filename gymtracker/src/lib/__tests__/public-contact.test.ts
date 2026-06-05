import { describe, expect, it } from 'vitest'
import { resolvePublicContactValue } from '@/lib/public-contact'

describe('public contact config', () => {
  it('uses the fallback when the value is missing', () => {
    expect(resolvePublicContactValue(undefined, 'fallback@example.com')).toBe(
      'fallback@example.com',
    )
  })

  it('uses the fallback when the value is empty', () => {
    expect(resolvePublicContactValue('', 'fallback@example.com')).toBe(
      'fallback@example.com',
    )
  })

  it('uses the fallback when the value contains only spaces', () => {
    expect(resolvePublicContactValue('   ', 'fallback@example.com')).toBe(
      'fallback@example.com',
    )
  })

  it('uses a trimmed valid value', () => {
    expect(resolvePublicContactValue(' hello@example.com ', 'fallback@example.com')).toBe(
      'hello@example.com',
    )
  })
})
