'use server'

import { deleteBodyMeasurement, saveBodyMeasurement } from '@/features/body-metrics/service'
import type { BodyMeasurementInput } from '@/features/body-metrics/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'
import type { BodyMeasurement } from '@/lib/types'
import { assertFiniteNumber, assertIsoDate, assertUuid } from '@/lib/validation'

const NUMERIC_FIELDS: (keyof Omit<BodyMeasurementInput, 'measuredAt' | 'notes'>)[] = [
    'height_cm',
    'weight_kg',
    'body_fat_pct',
    'chest_cm',
    'waist_cm',
    'hips_cm',
    'left_arm_cm',
    'right_arm_cm',
    'left_thigh_cm',
    'right_thigh_cm',
    'left_calf_cm',
    'right_calf_cm',
]

export async function saveBodyMeasurementAction(input: BodyMeasurementInput): Promise<ActionResult<BodyMeasurement>> {
    try {
        assertIsoDate(input.measuredAt, 'Measurement date')

        for (const field of NUMERIC_FIELDS) {
            const value = input[field]
            if (value != null) {
                assertFiniteNumber(value, field)
            }
        }

        const data = await saveBodyMeasurement(input)
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function deleteBodyMeasurementAction(id: string): Promise<ActionResult<null>> {
    try {
        assertUuid(id, 'Measurement id')
        await deleteBodyMeasurement(id)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
