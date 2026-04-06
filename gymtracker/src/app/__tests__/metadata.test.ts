import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'

describe('public metadata surfaces', () => {
    it('exposes only public routes in the sitemap', () => {
        const entries = sitemap().map((entry) => entry.url)

        expect(entries).toContain('https://gymtracker.app')
        expect(entries).toContain('https://gymtracker.app/privacy')
        expect(entries).toContain('https://gymtracker.app/terms')
        expect(entries).not.toContain('https://gymtracker.app/login')
        expect(entries).not.toContain('https://gymtracker.app/admin')
        expect(entries).not.toContain('https://gymtracker.app/today')
    })

    it('blocks indexing for private routes in robots', () => {
        const config = robots()
        const firstRule = Array.isArray(config.rules) ? config.rules[0] : config.rules

        const allow = Array.isArray(firstRule.allow)
            ? firstRule.allow
            : [firstRule.allow].filter((value): value is string => Boolean(value))
        const disallow = Array.isArray(firstRule.disallow)
            ? firstRule.disallow
            : [firstRule.disallow].filter((value): value is string => Boolean(value))

        expect(allow).toEqual(['/', '/privacy', '/terms'])
        expect(disallow).toContain('/login')
        expect(disallow).toContain('/admin')
        expect(disallow).toContain('/today')
    })
})
