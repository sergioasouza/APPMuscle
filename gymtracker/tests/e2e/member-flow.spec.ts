import { expect, test } from '@playwright/test'
import { memberStorageStatePath } from './auth-state'

const hasMemberCredentials = Boolean(process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD)

test.describe('member full workflow', () => {
    test.skip(!hasMemberCredentials, 'Missing E2E member credentials')
    test.use({ storageState: memberStorageStatePath })

    test('creates a workout variant, starts today, queues offline set sync, and checks history surfaces', async ({ context, page }) => {
        const stamp = Date.now()
        const workoutName = `E2E Segunda Onda ${stamp}`
        const exerciseName = `E2E Supino ${stamp}`

        await page.goto('/workouts')
        await page.getByRole('button', { name: /\+?\s*(Novo|New)/i }).click()
        await page.getByLabel(/Nome|Name/i).fill(workoutName)
        await page.getByRole('button', { name: /Criar|Create/i }).click()

        await expect(page).toHaveURL(/\/workouts\/[^/]+$/)
        await expect(page.getByLabel(/Nome do treino|Workout name/i)).toHaveValue(workoutName)

        await page.getByRole('button', { name: /Adicionar Exerc/i }).click()
        await page.getByPlaceholder(/Supino|Incline/i).fill(exerciseName)
        await page.getByRole('button', { name: /Criar e Adicionar|Create.*Add/i }).click()
        await expect(page.getByText(exerciseName)).toBeVisible()

        await page.getByRole('button', { name: /Salvar como variante|Save as variant/i }).click()
        await expect(page).toHaveURL(/\/workouts\/[^/]+$/)

        await page.goto('/schedule?previewDate=2026-04-20')
        await page.getByRole('button').filter({ hasText: /segunda|monday/i }).first().click()
        const firstSelect = page.locator('select').first()
        await expect(firstSelect).toBeVisible()
        const createdOptionValue = await firstSelect.locator('option').filter({ hasText: workoutName }).first().getAttribute('value')
        if (createdOptionValue) {
            await firstSelect.selectOption(createdOptionValue)
        }

        await page.goto('/today')
        if (await page.getByRole('button', { name: /Começar.*Mesmo Assim|Start a Workout Anyway/i }).isVisible()) {
            await page.getByRole('button', { name: /Começar.*Mesmo Assim|Start a Workout Anyway/i }).click()
            await page.getByRole('button', { name: new RegExp(workoutName, 'i') }).click()
        }

        await expect(page.getByText(/Online|pronto para salvar|ready to save/i)).toBeVisible()
        await context.setOffline(true)
        await expect(page.getByText(/Offline/i)).toBeVisible()

        await page.locator('input[inputmode="decimal"]').first().fill('42.5')
        await page.locator('input[inputmode="numeric"]').first().fill('8')
        await page.getByRole('button', { name: /Salvar|Save/i }).first().click()
        await expect(page.getByText(/fila|queued|pendente|pending/i)).toBeVisible()

        await context.setOffline(false)
        await page.getByRole('button', { name: /Sincronizar agora|Sync now/i }).click()
        await expect(page.getByText(/Online|ready to save|pronto para salvar/i)).toBeVisible()

        await page.goto('/calendar?month=2026-04')
        await expect(page.getByRole('heading', { name: /Calendário|Calendar/i })).toBeVisible()

        await page.goto('/analytics')
        await expect(page.getByRole('heading', { name: /Análise|Analytics/i })).toBeVisible()
    })
})
