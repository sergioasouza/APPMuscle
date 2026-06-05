import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { adminStorageStatePath, memberStorageStatePath } from './auth-state'

const hasMemberCredentials = Boolean(process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD)
const hasAdminCredentials = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD)

async function expectNoCriticalA11yViolations(page: import('@playwright/test').Page) {
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

    const violations = results.violations.filter((violation) =>
        violation.impact === 'critical' || violation.impact === 'serious'
    )

    expect(violations).toEqual([])
}

test.describe('public accessibility', () => {
    for (const route of ['/', '/login']) {
        test(`has no serious violations on ${route}`, async ({ page }) => {
            await page.goto(route)
            await expectNoCriticalA11yViolations(page)
        })
    }
})

test.describe('member accessibility and keyboard smoke', () => {
    test.skip(!hasMemberCredentials, 'Missing E2E member credentials')
    test.use({ storageState: memberStorageStatePath })

    for (const route of ['/today?date=2026-04-20', '/workouts', '/schedule?previewDate=2026-04-20', '/calendar?month=2026-04']) {
        test(`has no serious violations on ${route}`, async ({ page }) => {
            await page.goto(route)
            await expectNoCriticalA11yViolations(page)
        })
    }

    test('bottom navigation and calendar are keyboard reachable', async ({ page }) => {
        await page.goto('/calendar?month=2026-04')
        await page.keyboard.press('Tab')
        await expect(page.locator(':focus')).toBeVisible()
        await page.getByRole('button', { name: /Próximo mês|Next month/i }).focus()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('heading', { name: /Calendário|Calendar/i })).toBeVisible()
    })
})

test.describe('admin accessibility', () => {
    test.skip(!hasAdminCredentials, 'Missing E2E admin credentials')
    test.use({ storageState: adminStorageStatePath })

    for (const route of ['/admin', '/admin/users', '/admin/exercises']) {
        test(`has no serious violations on ${route}`, async ({ page }) => {
            await page.goto(route)
            await expectNoCriticalA11yViolations(page)
        })
    }
})
