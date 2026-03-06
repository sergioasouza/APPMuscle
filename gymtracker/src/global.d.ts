import 'next-intl'
import type { AppLocale } from '@/i18n/config'
import type enMessages from '@/messages/en.json'

declare module 'next-intl' {
    interface AppConfig {
        Locale: AppLocale
        Messages: typeof enMessages
    }
}
