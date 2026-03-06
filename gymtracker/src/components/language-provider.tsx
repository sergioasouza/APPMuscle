'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Language = 'en' | 'pt'

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: string) => string
}
import enDict from '@/messages/en.json'
import ptDict from '@/messages/pt.json'

const translations: Record<Language, any> = {
    en: enDict,
    pt: ptDict
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('en')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem('gymtracker_lang') as Language
        if (stored && (stored === 'en' || stored === 'pt')) {
            setLanguageState(stored)
        }
        setMounted(true)
    }, [])

    const setLanguage = (lang: Language) => {
        setLanguageState(lang)
        localStorage.setItem('gymtracker_lang', lang)
    }

    const t = (key: string) => {
        return translations[language]?.[key] || key
    }

    // The LanguageContext.Provider must ALWAYS wrap children.
    // If you need to avoid hydration mismatch flashes, handle the mounted state within the consumer component.

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
