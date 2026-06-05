import { expect, test } from '@playwright/test'
import { adminStorageStatePath } from './auth-state'

const hasAdminCredentials = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD)
const targetMemberEmail = process.env.E2E_TARGET_MEMBER_EMAIL

test.describe('admin full workflow', () => {
    test.skip(!hasAdminCredentials, 'Missing E2E admin credentials')
    test.use({ storageState: adminStorageStatePath })

    test('reviews admin dashboard, users, target member detail, and exercise catalog', async ({ page }) => {
        await page.goto('/admin')
        await expect(page.getByRole('heading', { name: /Central administrativa|Admin/i })).toBeVisible()
        await expect(page.getByText(/Acessos vencendo|expiring/i)).toBeVisible()

        await page.goto('/admin/users')
        await expect(page.getByRole('heading', { name: /Usuários|Users/i })).toBeVisible()

        if (targetMemberEmail) {
            const searchBox = page.getByPlaceholder(/buscar|search|email/i).first()
            if (await searchBox.isVisible()) {
                await searchBox.fill(targetMemberEmail)
            }
            await page.getByText(targetMemberEmail).first().click()
            await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/)
            await expect(page.getByText(targetMemberEmail).first()).toBeVisible()
        }

        await page.goto('/admin/exercises')
        await expect(page.getByRole('heading', { name: /Exercícios|Exercises/i })).toBeVisible()
        await expect(page.getByText(/catálogo|catalog|base/i).first()).toBeVisible()
    })
})
