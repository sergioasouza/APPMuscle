export const DEFAULT_CONTACT_EMAIL = 'saslabs.tech@gmail.com'

export const DEFAULT_PUBLIC_WHATSAPP_URL =
  'https://wa.me/5531992936893'

export const DEFAULT_PUBLIC_WHATSAPP_LABEL =
  '(31) 99293-6893'

export type PublicContact = {
  whatsappUrl: string
  contactEmail: string
}

export function resolvePublicContactValue(
  value: string | null | undefined,
  fallback: string,
) {
  const trimmedValue = value?.trim()

  return trimmedValue ? trimmedValue : fallback
}

function extractPublicWhatsAppDigits(whatsappUrl: string) {
  const waMeDigits = whatsappUrl.match(/wa\.me\/([^?#/]+)/i)?.[1]

  if (waMeDigits) {
    return waMeDigits.replace(/\D/g, '')
  }

  const phoneValue = whatsappUrl.match(/phone=([^&#\s]+)/i)?.[1]

  if (!phoneValue) {
    return null
  }

  try {
    return decodeURIComponent(phoneValue).replace(/\D/g, '')
  } catch {
    return phoneValue.replace(/\D/g, '')
  }
}

export function formatPublicWhatsAppLabel(whatsappUrl: string) {
  const digits = extractPublicWhatsAppDigits(whatsappUrl)

  if (digits?.startsWith('55') && digits.length === 13) {
    const areaCode = digits.slice(2, 4)
    const subscriberNumber = digits.slice(4)

    return `(${areaCode}) ${subscriberNumber.slice(0, 5)}-${subscriberNumber.slice(5)}`
  }

  if (digits?.startsWith('55') && digits.length === 12) {
    const areaCode = digits.slice(2, 4)
    const subscriberNumber = digits.slice(4)

    return `(${areaCode}) ${subscriberNumber.slice(0, 4)}-${subscriberNumber.slice(4)}`
  }

  return DEFAULT_PUBLIC_WHATSAPP_LABEL
}

export function getLandingPublicContact(): PublicContact {
  return {
    whatsappUrl: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_WHATSAPP_URL,
      DEFAULT_PUBLIC_WHATSAPP_URL,
    ),
    contactEmail: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_EMAIL,
      DEFAULT_CONTACT_EMAIL,
    ),
  }
}

export function getBlockedPublicContact(): PublicContact {
  return {
    whatsappUrl: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_WHATSAPP_URL,
      DEFAULT_PUBLIC_WHATSAPP_URL,
    ),
    contactEmail: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_EMAIL,
      DEFAULT_CONTACT_EMAIL,
    ),
  }
}

export function getPublicContactDisplay(
  contact: PublicContact = getLandingPublicContact(),
) {
  return {
    whatsappLabel: formatPublicWhatsAppLabel(contact.whatsappUrl),
    contactEmail: contact.contactEmail,
  }
}
