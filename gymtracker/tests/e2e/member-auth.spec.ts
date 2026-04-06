import { test, expect } from '@playwright/test'

const memberEmail = process.env.E2E_MEMBER_EMAIL
const memberPassword = process.env.E2E_MEMBER_PASSWORD

test.describe('member authentication', () => {
    test.skip(!memberEmail || !memberPassword, 'Missing E2E member credentials')

    test('active member can sign in and reach the app', async ({ page }) => {
        await page.goto('/login')
        await page.getByLabel('E-mail').fill(memberEmail!)
        await page.getByLabel('Senha').fill(memberPassword!)
        await page.getByRole('button', { name: 'Entrar' }).click()

        await expect(page).toHaveURL(/\/today$/)
        await expect(page.getByText('Hoje')).toBeVisible()
    })
})
