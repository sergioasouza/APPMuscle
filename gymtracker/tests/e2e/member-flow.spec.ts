import { expect, test } from '@playwright/test'
import { memberStorageStatePath } from './auth-state'

const hasMemberCredentials = Boolean(process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD)
const saveSegmentButtonName = /Salvar segmento|Save segment/i
const pendingSyncText = /Sincronização pendente|Pending sync/i
const dayNamePatterns = [
    /domingo|sunday/i,
    /segunda|monday/i,
    /terça|tuesday/i,
    /quarta|wednesday/i,
    /quinta|thursday/i,
    /sexta|friday/i,
    /sábado|saturday/i,
]

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatISODate(date: Date) {
    return date.toISOString().slice(0, 10)
}

function getDayOfWeekFromISO(dateISO: string) {
    const [year, month, day] = dateISO.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay()
}

function buildTargetDateISO(isMobileProject: boolean) {
    const runWeekOffset = Math.floor((Date.now() % 1_000_000) / 1000)
    const projectDayOffset = isMobileProject ? 1 : 0

    return formatISODate(new Date(Date.UTC(2030, 0, 1 + runWeekOffset * 7 + projectDayOffset, 12, 0, 0)))
}

async function ensureTodayWorkout(page: import('@playwright/test').Page, workoutName: string) {
    const workoutHeading = page.getByRole('heading', { name: workoutName, exact: true, level: 1 })
    if (await workoutHeading.isVisible()) {
        return
    }

    const startAnywayButton = page.getByRole('button', { name: /Começar.*Mesmo Assim|Start a Workout Anyway/i })
    if (await startAnywayButton.isVisible()) {
        await startAnywayButton.click()
    } else {
        await page.getByRole('button', { name: /Mudar Treino|Switch Workout/i }).click()
    }

    await page.getByRole('button', { name: workoutName, exact: true }).click()
    await expect(workoutHeading).toBeVisible()
}

async function completeConceptualSet(
    conceptualSet: import('@playwright/test').Locator,
    segmentCount: number,
    weight: string,
    reps: string,
) {
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
        await conceptualSet.getByRole('spinbutton').nth(segmentIndex * 2).fill(weight)
        await conceptualSet.getByRole('spinbutton').nth(segmentIndex * 2 + 1).fill(reps)
        await conceptualSet.getByRole('button', { name: saveSegmentButtonName }).first().click()
    }

    await conceptualSet.getByRole('button', { name: /Concluir série|Complete set/i }).click()
    await expect(conceptualSet.getByText(/Concluída|Completed/i)).toBeVisible()
}

test.describe('member full workflow', () => {
    test.skip(!hasMemberCredentials, 'Missing E2E member credentials')
    test.use({ storageState: memberStorageStatePath })

    test('creates a workout variant, starts today, queues offline set sync, and checks history surfaces', async ({ context, page }, testInfo) => {
        const isMobileProject = testInfo.project.name.includes('mobile')
        const targetDateISO = buildTargetDateISO(isMobileProject)
        const targetDayName = dayNamePatterns[getDayOfWeekFromISO(targetDateISO)]
        const projectSuffix = isMobileProject ? 'Mobile' : 'Desktop'
        const stamp = `${Date.now()}-${projectSuffix}`
        const workoutName = `E2E Segunda Onda ${stamp}`
        const exerciseName = `E2E Supino ${stamp}`
        const firstSetName = new RegExp(`${escapeRegExp(exerciseName)}.*(?:série|set)\\s+1`, 'i')

        await page.goto('/workouts')
        await page.evaluate(() => window.localStorage.removeItem('gymtracker.pending-set-queue'))
        await page.waitForLoadState('networkidle')
        await page.getByRole('button', { name: /\+?\s*(Novo|New)/i }).click()
        await page.getByLabel(/Nome|Name/i).fill(workoutName)
        await page.getByRole('button', { name: /Criar|Create/i }).click()

        await expect(page).toHaveURL(/\/workouts\/[^/]+$/)
        await page.waitForLoadState('networkidle')
        await expect(page.getByLabel(/Nome do treino|Workout name/i)).toHaveValue(workoutName)

        await page.getByRole('button', { name: /Adicionar Exerc/i }).click()
        await expect(page.getByPlaceholder(/Supino|Incline/i)).toBeVisible()
        await page.getByPlaceholder(/Supino|Incline/i).fill(exerciseName)
        await page.getByRole('button', { name: /Criar e Adicionar|Create.*Add/i }).click()
        await expect(page.getByRole('link', { name: new RegExp(escapeRegExp(exerciseName), 'i') })).toBeVisible()

        const addSetButton = page.getByRole('button', { name: /Adicionar série|Add set/i })
        for (const expectedCount of [4, 5, 6]) {
            await expect(addSetButton).toBeEnabled()
            await addSetButton.click()
            await expect(page.getByTestId('set-prescription')).toHaveCount(expectedCount)
        }

        const mixedMethods = [
            'cluster',
            'myo_reps',
            'drop_set',
            'rest_pause',
            'amrap',
            'straight',
        ]
        for (const [index, method] of mixedMethods.entries()) {
            const methodSelect = page.getByLabel(new RegExp(`(?:Método|Method) ${index + 1}`, 'i'))
            await expect(methodSelect).toBeEnabled()
            await methodSelect.selectOption(method)
            await expect(page.getByTestId('set-prescription').nth(index)).toHaveAttribute('data-set-method', method)
            await expect(methodSelect).toBeEnabled()
        }

        await page.getByRole('button', { name: /Salvar como variante|Save as variant/i }).click()
        await expect(page).toHaveURL(/\/workouts\/[^/]+$/)

        await page.goto(`/schedule?previewDate=${targetDateISO}`)
        const targetDayButton = page.getByRole('button').filter({ hasText: targetDayName }).first()
        await targetDayButton.click()
        const firstSelect = page.locator('select').first()
        await expect(firstSelect).toBeVisible()
        const createdOption = firstSelect.locator('option').filter({ hasText: workoutName }).first()
        await expect(createdOption).toBeAttached()
        const createdOptionValue = await createdOption.getAttribute('value')
        expect(createdOptionValue).toBeTruthy()
        await firstSelect.selectOption(createdOptionValue!)
        await expect(targetDayButton).toContainText(workoutName)

        await page.goto(`/today?date=${targetDateISO}`)
        await ensureTodayWorkout(page, workoutName)

        const firstSet = page.getByRole('group', { name: firstSetName })
        const syncStatus = page.getByRole('status')
        await expect(firstSet).toBeVisible()
        await expect(syncStatus).toContainText(/Online|pronto para salvar|ready to save/i)
        await context.setOffline(true)
        await expect(syncStatus).toContainText(/Offline/i)

        await firstSet.getByRole('spinbutton').nth(0).fill('42.5')
        await firstSet.getByRole('spinbutton').nth(1).fill('8')
        const saveSegmentButton = firstSet.getByRole('button', { name: saveSegmentButtonName })
        await expect(saveSegmentButton).toBeEnabled()
        await saveSegmentButton.click()
        await expect(firstSet.getByText(pendingSyncText)).toBeVisible()

        await context.setOffline(false)
        const syncButton = page.getByRole('button', { name: /Sincronizar agora|Sync now/i })
        await expect(syncStatus).toContainText(/Online|ready to save|pronto para salvar/i)
        if (await syncButton.isVisible()) {
            await expect(syncButton).toBeEnabled()
            await syncButton.click()
        }
        await expect(firstSet.getByText(pendingSyncText)).toHaveCount(0)
        await expect(page.getByRole('timer')).toBeVisible()

        for (let segmentIndex = 1; segmentIndex < 4; segmentIndex += 1) {
            await firstSet.getByRole('spinbutton').nth(segmentIndex * 2).fill('42.5')
            await firstSet.getByRole('spinbutton').nth(segmentIndex * 2 + 1).fill('2')
            await firstSet.getByRole('button', { name: saveSegmentButtonName }).first().click()
        }
        await firstSet.getByRole('button', { name: /Concluir série|Complete set/i }).click()
        await expect(firstSet.getByText(/Concluída|Completed/i)).toBeVisible()

        const myoSet = page.locator('[data-testid="conceptual-set"][data-set-method="myo_reps"]').first()
        const resolvedMyoSet = (await myoSet.count()) > 0
            ? myoSet
            : page.getByTestId('conceptual-set').nth(1)
        await resolvedMyoSet.getByRole('spinbutton').nth(0).fill('30')
        await resolvedMyoSet.getByRole('spinbutton').nth(1).fill('15')
        await resolvedMyoSet.getByRole('button', { name: saveSegmentButtonName }).first().click()
        await resolvedMyoSet.getByRole('button', { name: /Encerrar myo-reps|Stop myo-reps/i }).click()
        await expect(resolvedMyoSet.getByText(/Encerrada|Stopped/i)).toBeVisible()

        await completeConceptualSet(
            page.locator('[data-testid="conceptual-set"][data-set-method="drop_set"]'),
            3,
            '35',
            '8',
        )
        await completeConceptualSet(
            page.locator('[data-testid="conceptual-set"][data-set-method="rest_pause"]'),
            4,
            '32.5',
            '3',
        )
        await completeConceptualSet(
            page.locator('[data-testid="conceptual-set"][data-set-method="amrap"]'),
            1,
            '30',
            '12',
        )
        await completeConceptualSet(
            page.locator('[data-testid="conceptual-set"][data-set-method="straight"]'),
            1,
            '40',
            '10',
        )

        await page.goto(`/calendar?month=${targetDateISO.slice(0, 7)}`)
        await expect(page.getByRole('heading', { name: /Calendário|Calendar/i })).toBeVisible()

        await page.goto('/analytics')
        await expect(page.getByRole('heading', { name: /Análise|Analytics/i })).toBeVisible()
    })
})
