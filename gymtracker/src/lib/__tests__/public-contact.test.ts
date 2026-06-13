import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTACT_EMAIL,
  DEFAULT_PUBLIC_WHATSAPP_LABEL,
  DEFAULT_PUBLIC_WHATSAPP_URL,
  formatPublicWhatsAppLabel,
  getPublicContactDisplay,
  resolvePublicContactValue,
} from '@/lib/public-contact'

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

  it('ships the public SAS Labs contact defaults', () => {
    expect(DEFAULT_PUBLIC_WHATSAPP_URL).toBe('https://wa.me/5531992936893')
    expect(DEFAULT_CONTACT_EMAIL).toBe('saslabs.tech@gmail.com')
    expect(DEFAULT_PUBLIC_WHATSAPP_LABEL).toBe('(31) 99293-6893')
  })

  it('exposes display labels for the public contact cards', () => {
    expect(
      getPublicContactDisplay({
        whatsappUrl: DEFAULT_PUBLIC_WHATSAPP_URL,
        contactEmail: DEFAULT_CONTACT_EMAIL,
      }),
    ).toEqual({
      whatsappLabel: '(31) 99293-6893',
      contactEmail: 'saslabs.tech@gmail.com',
    })
  })

  it('exposes display labels for a resolved custom public contact', () => {
    expect(
      getPublicContactDisplay({
        whatsappUrl: 'https://wa.me/5511999998888',
        contactEmail: 'custom@example.com',
      }),
    ).toEqual({
      whatsappLabel: '(11) 99999-8888',
      contactEmail: 'custom@example.com',
    })
  })

  it('formats wa.me links as public WhatsApp labels', () => {
    expect(formatPublicWhatsAppLabel('https://wa.me/5531992936893')).toBe(
      '(31) 99293-6893',
    )
  })

  it('formats WhatsApp phone query links as public WhatsApp labels', () => {
    expect(
      formatPublicWhatsAppLabel(
        'https://api.whatsapp.com/send?phone=5531992936893',
      ),
    ).toBe('(31) 99293-6893')
  })

  it('formats phone query strings as public WhatsApp labels', () => {
    expect(formatPublicWhatsAppLabel('phone=553133334444')).toBe(
      '(31) 3333-4444',
    )
  })

  it('falls back when the WhatsApp URL does not include a valid phone', () => {
    expect(
      formatPublicWhatsAppLabel('https://api.whatsapp.com/send?text=hello'),
    ).toBe(DEFAULT_PUBLIC_WHATSAPP_LABEL)
  })
})
