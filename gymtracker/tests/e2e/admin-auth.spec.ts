import { test, expect } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test.describe('admin authentication', () => {
    test.skip(!adminEmail || !adminPassword, 'Missing E2E admin credentials')

    test('admin lands on the backoffice', async ({ page }) => {
        await page.goto('/login')
        await page.getByLabel('E-mail').fill(adminEmail!)
        await page.getByLabel('Senha').fill(adminPassword!)
        await page.getByRole('button', { name: 'Entrar' }).click()

        await expect(page).toHaveURL(/\/admin$/)
        await expect(page.getByText('Visão geral')).toBeVisible()
    })
})
