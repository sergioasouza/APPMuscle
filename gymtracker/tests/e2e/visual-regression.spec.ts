import { expect, test } from '@playwright/test'
import { adminStorageStatePath, memberStorageStatePath } from './auth-state'

const hasMemberCredentials = Boolean(process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD)
const hasAdminCredentials = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD)

async function expectRouteScreenshot(page: import('@playwright/test').Page, path: string, name: string) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot(name, {
        fullPage: true,
        animations: 'disabled',
        caret: 'initial',
        maxDiffPixelRatio: 0.02,
    })
}

test.describe('public visual regression', () => {
    test('captures public shell routes', async ({ page }) => {
        await expectRouteScreenshot(page, '/', 'public-home.png')
        await expectRouteScreenshot(page, '/login', 'public-login.png')
    })
})

test.describe('member visual regression', () => {
    test.skip(!hasMemberCredentials, 'Missing E2E member credentials')
    test.use({ storageState: memberStorageStatePath })

    test('captures member app routes with stable dates', async ({ page }) => {
        await expectRouteScreenshot(page, '/today?date=2026-04-20', 'member-today.png')
        await expectRouteScreenshot(page, '/workouts', 'member-workouts.png')
        await expectRouteScreenshot(page, '/schedule?previewDate=2026-04-20', 'member-schedule.png')
        await expectRouteScreenshot(page, '/calendar?month=2026-04', 'member-calendar.png')
        await expectRouteScreenshot(page, '/analytics', 'member-analytics.png')
        await expectRouteScreenshot(page, '/profile', 'member-profile.png')

        await page.goto('/workouts')
        const editButton = page.getByRole('button', { name: /Editar|Edit/i }).first()
        if (await editButton.isVisible()) {
            await editButton.click()
            await page.waitForLoadState('networkidle')
            await expect(page).toHaveScreenshot('member-workout-editor.png', {
                fullPage: true,
                animations: 'disabled',
                caret: 'initial',
                maxDiffPixelRatio: 0.02,
            })
        }
    })
})

test.describe('admin visual regression', () => {
    test.skip(!hasAdminCredentials, 'Missing E2E admin credentials')
    test.use({ storageState: adminStorageStatePath })

    test('captures admin routes', async ({ page }) => {
        await expectRouteScreenshot(page, '/admin', 'admin-dashboard.png')
        await expectRouteScreenshot(page, '/admin/users', 'admin-users.png')
        await expectRouteScreenshot(page, '/admin/exercises', 'admin-exercises.png')
    })
})
