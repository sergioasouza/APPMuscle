export const DEFAULT_CONTACT_EMAIL = 'contato@gymtracker.app'

export const DEFAULT_LANDING_WHATSAPP_URL =
  'https://wa.me/5500000000000?text=Quero%20conhecer%20o%20GymTracker'

export const DEFAULT_BLOCKED_WHATSAPP_URL =
  'https://wa.me/5500000000000?text=Preciso%20regularizar%20meu%20acesso%20ao%20GymTracker'

export function resolvePublicContactValue(
  value: string | null | undefined,
  fallback: string,
) {
  const trimmedValue = value?.trim()

  return trimmedValue ? trimmedValue : fallback
}

export function getLandingPublicContact() {
  return {
    whatsappUrl: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_WHATSAPP_URL,
      DEFAULT_LANDING_WHATSAPP_URL,
    ),
    contactEmail: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_EMAIL,
      DEFAULT_CONTACT_EMAIL,
    ),
  }
}

export function getBlockedPublicContact() {
  return {
    whatsappUrl: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_WHATSAPP_URL,
      DEFAULT_BLOCKED_WHATSAPP_URL,
    ),
    contactEmail: resolvePublicContactValue(
      process.env.NEXT_PUBLIC_CONTACT_EMAIL,
      DEFAULT_CONTACT_EMAIL,
    ),
  }
}
