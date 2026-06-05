import { test, expect } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test.describe('admin authentication', () => {
    test.skip(!adminEmail || !adminPassword, 'Missing E2E admin credentials')

    test('admin lands on the attention dashboard', async ({ page }) => {
        await page.goto('/login')
        await page.getByLabel(/E-mail|Email/i).fill(adminEmail!)
        await page.getByLabel(/Senha|Password/i).fill(adminPassword!)
        await page.getByRole('button', { name: /Entrar|Sign In/i }).click()

        await expect(page).toHaveURL(/\/admin$/)
        await expect(page.getByText('Central administrativa')).toBeVisible()
        await expect(page.getByText('Acessos vencendo')).toBeVisible()
        await expect(page.getByText('Renovações pendentes')).toBeVisible()
        await expect(page.getByText('Usuários inativos')).toBeVisible()
    })
})
