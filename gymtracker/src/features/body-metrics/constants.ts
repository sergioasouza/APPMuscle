export const BODY_MEASUREMENT_FIELDS = [
    { key: 'height_cm', translationKey: 'height', unit: 'cm', step: '0.1' },
    { key: 'weight_kg', translationKey: 'weight', unit: 'kg', step: '0.1' },
    { key: 'body_fat_pct', translationKey: 'bodyFat', unit: '%', step: '0.1' },
    { key: 'chest_cm', translationKey: 'chest', unit: 'cm', step: '0.1' },
    { key: 'waist_cm', translationKey: 'waist', unit: 'cm', step: '0.1' },
    { key: 'hips_cm', translationKey: 'hips', unit: 'cm', step: '0.1' },
    { key: 'left_arm_cm', translationKey: 'leftArm', unit: 'cm', step: '0.1' },
    { key: 'right_arm_cm', translationKey: 'rightArm', unit: 'cm', step: '0.1' },
    { key: 'left_thigh_cm', translationKey: 'leftThigh', unit: 'cm', step: '0.1' },
    { key: 'right_thigh_cm', translationKey: 'rightThigh', unit: 'cm', step: '0.1' },
    { key: 'left_calf_cm', translationKey: 'leftCalf', unit: 'cm', step: '0.1' },
    { key: 'right_calf_cm', translationKey: 'rightCalf', unit: 'cm', step: '0.1' },
] as const

export type BodyMeasurementFieldKey = (typeof BODY_MEASUREMENT_FIELDS)[number]['key']
