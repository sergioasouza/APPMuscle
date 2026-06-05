import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect, test } from '@playwright/test'
import { adminStorageStatePath, memberStorageStatePath } from './auth-state'

async function signInAndPersist(page: import('@playwright/test').Page, email: string, password: string, storageStatePath: string) {
    await page.goto('/login')
    await page.getByLabel(/E-mail|Email/i).fill(email)
    await page.getByLabel(/Senha|Password/i).fill(password)
    await page.getByRole('button', { name: /Entrar|Sign In/i }).click()
    await expect(page).not.toHaveURL(/\/login$/)

    await mkdir(dirname(storageStatePath), { recursive: true })
    await page.context().storageState({ path: storageStatePath })
}

test('persist member session', async ({ page }) => {
    test.skip(!process.env.E2E_MEMBER_EMAIL || !process.env.E2E_MEMBER_PASSWORD, 'Missing E2E member credentials')

    await signInAndPersist(
        page,
        process.env.E2E_MEMBER_EMAIL!,
        process.env.E2E_MEMBER_PASSWORD!,
        memberStorageStatePath,
    )
})

test('persist admin session', async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, 'Missing E2E admin credentials')

    await signInAndPersist(
        page,
        process.env.E2E_ADMIN_EMAIL!,
        process.env.E2E_ADMIN_PASSWORD!,
        adminStorageStatePath,
    )
})
