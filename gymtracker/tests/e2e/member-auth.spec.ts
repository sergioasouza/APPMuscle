import { test, expect } from '@playwright/test'

const memberEmail = process.env.E2E_MEMBER_EMAIL
const memberPassword = process.env.E2E_MEMBER_PASSWORD

test.describe('member authentication', () => {
    test.skip(!memberEmail || !memberPassword, 'Missing E2E member credentials')

    test('active member can sign in and reach the app shell', async ({ page }) => {
        await page.goto('/login')
        await page.getByLabel(/E-mail|Email/i).fill(memberEmail!)
        await page.getByLabel(/Senha|Password/i).fill(memberPassword!)
        await page.getByRole('button', { name: /Entrar|Sign In/i }).click()

        await expect(page).toHaveURL(/\/today$/)
        await expect(page.getByText('Hoje')).toBeVisible()

        await page.goto('/profile')
        await expect(page).toHaveURL(/\/profile$/)
        await expect(page.getByText('Conta e preferências')).toBeVisible()
    })
})
