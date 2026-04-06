/* eslint-disable @typescript-eslint/no-empty-object-type */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    display_name: string
                    rotation_anchor_date: string | null
                    role: 'member' | 'admin'
                    access_status: 'active' | 'blocked'
                    member_access_mode: 'internal' | 'billable' | 'trial'
                    billing_day_of_month: number | null
                    billing_grace_business_days: number
                    paid_until: string | null
                    trial_ends_at: string | null
                    must_change_password: boolean
                    created_by_admin_id: string | null
                    updated_at: string
                    created_at: string
                }
                Insert: {
                    id: string
                    display_name: string
                    rotation_anchor_date?: string | null
                    role?: 'member' | 'admin'
                    access_status?: 'active' | 'blocked'
                    member_access_mode?: 'internal' | 'billable' | 'trial'
                    billing_day_of_month?: number | null
                    billing_grace_business_days?: number
                    paid_until?: string | null
                    trial_ends_at?: string | null
                    must_change_password?: boolean
                    created_by_admin_id?: string | null
                    updated_at?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    display_name?: string
                    rotation_anchor_date?: string | null
                    role?: 'member' | 'admin'
                    access_status?: 'active' | 'blocked'
                    member_access_mode?: 'internal' | 'billable' | 'trial'
                    billing_day_of_month?: number | null
                    billing_grace_business_days?: number
                    paid_until?: string | null
                    trial_ends_at?: string | null
                    must_change_password?: boolean
                    created_by_admin_id?: string | null
                    updated_at?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_created_by_admin_id_fkey"
                        columns: ["created_by_admin_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            exercises: {
                Row: {
                    id: string
                    user_id: string | null
                    name: string
                    system_key: string | null
                    is_system: boolean
                    modality: string | null
                    muscle_group: string | null
                    archived_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    name: string
                    system_key?: string | null
                    is_system?: boolean
                    modality?: string | null
                    muscle_group?: string | null
                    archived_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    name?: string
                    system_key?: string | null
                    is_system?: boolean
                    modality?: string | null
                    muscle_group?: string | null
                    archived_at?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "exercises_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            exercise_overrides: {
                Row: {
                    id: string
                    user_id: string
                    exercise_id: string
                    custom_name: string | null
                    custom_modality: string | null
                    custom_muscle_group: string | null
                    archived_at: string | null
                    hidden_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    exercise_id: string
                    custom_name?: string | null
                    custom_modality?: string | null
                    custom_muscle_group?: string | null
                    archived_at?: string | null
                    hidden_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    exercise_id?: string
                    custom_name?: string | null
                    custom_modality?: string | null
                    custom_muscle_group?: string | null
                    archived_at?: string | null
                    hidden_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "exercise_overrides_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "exercise_overrides_exercise_id_fkey"
                        columns: ["exercise_id"]
                        isOneToOne: false
                        referencedRelation: "exercises"
                        referencedColumns: ["id"]
                    }
                ]
            }
            workouts: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "workouts_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            workout_exercises: {
                Row: {
                    id: string
                    workout_id: string
                    exercise_id: string
                    target_sets: number
                    display_order: number
                }
                Insert: {
                    id?: string
                    workout_id: string
                    exercise_id: string
                    target_sets?: number
                    display_order?: number
                }
                Update: {
                    id?: string
                    workout_id?: string
                    exercise_id?: string
                    target_sets?: number
                    display_order?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "workout_exercises_workout_id_fkey"
                        columns: ["workout_id"]
                        isOneToOne: false
                        referencedRelation: "workouts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "workout_exercises_exercise_id_fkey"
                        columns: ["exercise_id"]
                        isOneToOne: false
                        referencedRelation: "exercises"
                        referencedColumns: ["id"]
                    }
                ]
            }
            workout_cardio_blocks: {
                Row: {
                    id: string
                    workout_id: string
                    name: string
                    target_duration_minutes: number | null
                    display_order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    workout_id: string
                    name: string
                    target_duration_minutes?: number | null
                    display_order?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    workout_id?: string
                    name?: string
                    target_duration_minutes?: number | null
                    display_order?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "workout_cardio_blocks_workout_id_fkey"
                        columns: ["workout_id"]
                        isOneToOne: false
                        referencedRelation: "workouts"
                        referencedColumns: ["id"]
                    }
                ]
            }
            schedule: {
                Row: {
                    id: string
                    user_id: string
                    workout_id: string
                    day_of_week: number
                }
                Insert: {
                    id?: string
                    user_id: string
                    workout_id: string
                    day_of_week: number
                }
                Update: {
                    id?: string
                    user_id?: string
                    workout_id?: string
                    day_of_week?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "schedule_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "schedule_workout_id_fkey"
                        columns: ["workout_id"]
                        isOneToOne: false
                        referencedRelation: "workouts"
                        referencedColumns: ["id"]
                    }
                ]
            }
            schedule_rotations: {
                Row: {
                    id: string
                    user_id: string
                    workout_id: string
                    day_of_week: number
                    rotation_index: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    workout_id: string
                    day_of_week: number
                    rotation_index: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    workout_id?: string
                    day_of_week?: number
                    rotation_index?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "schedule_rotations_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "schedule_rotations_workout_id_fkey"
                        columns: ["workout_id"]
                        isOneToOne: false
                        referencedRelation: "workouts"
                        referencedColumns: ["id"]
                    }
                ]
            }
            workout_sessions: {
                Row: {
                    id: string
                    user_id: string
                    workout_id: string
                    performed_at: string
                    notes: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    workout_id: string
                    performed_at?: string
                    notes?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    workout_id?: string
                    performed_at?: string
                    notes?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "workout_sessions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "workout_sessions_workout_id_fkey"
                        columns: ["workout_id"]
                        isOneToOne: false
                        referencedRelation: "workouts"
                        referencedColumns: ["id"]
                    }
                ]
            }
            set_logs: {
                Row: {
                    id: string
                    session_id: string
                    exercise_id: string
                    set_number: number
                    weight_kg: number
                    reps: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    exercise_id: string
                    set_number: number
                    weight_kg: number
                    reps: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    exercise_id?: string
                    set_number?: number
                    weight_kg?: number
                    reps?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "set_logs_session_id_fkey"
                        columns: ["session_id"]
                        isOneToOne: false
                        referencedRelation: "workout_sessions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "set_logs_exercise_id_fkey"
                        columns: ["exercise_id"]
                        isOneToOne: false
                        referencedRelation: "exercises"
                        referencedColumns: ["id"]
                    }
                ]
            }
            session_exercise_skips: {
                Row: {
                    id: string
                    session_id: string
                    exercise_id: string
                    skipped_at: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    exercise_id: string
                    skipped_at?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    exercise_id?: string
                    skipped_at?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "session_exercise_skips_session_id_fkey"
                        columns: ["session_id"]
                        isOneToOne: false
                        referencedRelation: "workout_sessions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "session_exercise_skips_exercise_id_fkey"
                        columns: ["exercise_id"]
                        isOneToOne: false
                        referencedRelation: "exercises"
                        referencedColumns: ["id"]
                    }
                ]
            }
            session_cardio_logs: {
                Row: {
                    id: string
                    session_id: string
                    workout_cardio_block_id: string
                    total_duration_minutes: number | null
                    total_distance_km: number | null
                    skipped_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    workout_cardio_block_id: string
                    total_duration_minutes?: number | null
                    total_distance_km?: number | null
                    skipped_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    workout_cardio_block_id?: string
                    total_duration_minutes?: number | null
                    total_distance_km?: number | null
                    skipped_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "session_cardio_logs_session_id_fkey"
                        columns: ["session_id"]
                        isOneToOne: false
                        referencedRelation: "workout_sessions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "session_cardio_logs_workout_cardio_block_id_fkey"
                        columns: ["workout_cardio_block_id"]
                        isOneToOne: false
                        referencedRelation: "workout_cardio_blocks"
                        referencedColumns: ["id"]
                    }
                ]
            }
            session_cardio_intervals: {
                Row: {
                    id: string
                    cardio_log_id: string
                    display_order: number
                    duration_minutes: number
                    speed_kmh: number | null
                    repeat_count: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    cardio_log_id: string
                    display_order?: number
                    duration_minutes: number
                    speed_kmh?: number | null
                    repeat_count?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    cardio_log_id?: string
                    display_order?: number
                    duration_minutes?: number
                    speed_kmh?: number | null
                    repeat_count?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "session_cardio_intervals_cardio_log_id_fkey"
                        columns: ["cardio_log_id"]
                        isOneToOne: false
                        referencedRelation: "session_cardio_logs"
                        referencedColumns: ["id"]
                    }
                ]
            }
            body_measurements: {
                Row: {
                    id: string
                    user_id: string
                    measured_at: string
                    height_cm: number | null
                    weight_kg: number | null
                    body_fat_pct: number | null
                    chest_cm: number | null
                    waist_cm: number | null
                    hips_cm: number | null
                    left_arm_cm: number | null
                    right_arm_cm: number | null
                    left_thigh_cm: number | null
                    right_thigh_cm: number | null
                    left_calf_cm: number | null
                    right_calf_cm: number | null
                    notes: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    measured_at: string
                    height_cm?: number | null
                    weight_kg?: number | null
                    body_fat_pct?: number | null
                    chest_cm?: number | null
                    waist_cm?: number | null
                    hips_cm?: number | null
                    left_arm_cm?: number | null
                    right_arm_cm?: number | null
                    left_thigh_cm?: number | null
                    right_thigh_cm?: number | null
                    left_calf_cm?: number | null
                    right_calf_cm?: number | null
                    notes?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    measured_at?: string
                    height_cm?: number | null
                    weight_kg?: number | null
                    body_fat_pct?: number | null
                    chest_cm?: number | null
                    waist_cm?: number | null
                    hips_cm?: number | null
                    left_arm_cm?: number | null
                    right_arm_cm?: number | null
                    left_thigh_cm?: number | null
                    right_thigh_cm?: number | null
                    left_calf_cm?: number | null
                    right_calf_cm?: number | null
                    notes?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "body_measurements_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            manual_billing_events: {
                Row: {
                    id: string
                    user_id: string
                    reference_month: string
                    status: 'paid' | 'unpaid' | 'waived'
                    note: string | null
                    recorded_by: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    reference_month: string
                    status: 'paid' | 'unpaid' | 'waived'
                    note?: string | null
                    recorded_by: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    reference_month?: string
                    status?: 'paid' | 'unpaid' | 'waived'
                    note?: string | null
                    recorded_by?: string
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "manual_billing_events_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "manual_billing_events_recorded_by_fkey"
                        columns: ["recorded_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            admin_audit_log: {
                Row: {
                    id: string
                    actor_user_id: string
                    target_user_id: string | null
                    entity_type: 'user' | 'exercise' | 'billing' | 'access' | 'auth' | 'system'
                    entity_id: string | null
                    action: string
                    metadata: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    actor_user_id: string
                    target_user_id?: string | null
                    entity_type: 'user' | 'exercise' | 'billing' | 'access' | 'auth' | 'system'
                    entity_id?: string | null
                    action: string
                    metadata?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    actor_user_id?: string
                    target_user_id?: string | null
                    entity_type?: 'user' | 'exercise' | 'billing' | 'access' | 'auth' | 'system'
                    entity_id?: string | null
                    action?: string
                    metadata?: Json
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "admin_audit_log_actor_user_id_fkey"
                        columns: ["actor_user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "admin_audit_log_target_user_id_fkey"
                        columns: ["target_user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {}
        Functions: {}
        Enums: {}
        CompositeTypes: {}
    }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type ExerciseOverride = Database['public']['Tables']['exercise_overrides']['Row']
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row']
export type WorkoutCardioBlock = Database['public']['Tables']['workout_cardio_blocks']['Row']
export type Schedule = Database['public']['Tables']['schedule']['Row']
export type ScheduleRotation = Database['public']['Tables']['schedule_rotations']['Row']
export type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row']
export type SetLog = Database['public']['Tables']['set_logs']['Row']
export type SessionExerciseSkip = Database['public']['Tables']['session_exercise_skips']['Row']
export type SessionCardioLog = Database['public']['Tables']['session_cardio_logs']['Row']
export type SessionCardioInterval = Database['public']['Tables']['session_cardio_intervals']['Row']
export type BodyMeasurement = Database['public']['Tables']['body_measurements']['Row']
export type ManualBillingEvent = Database['public']['Tables']['manual_billing_events']['Row']
export type AdminAuditLog = Database['public']['Tables']['admin_audit_log']['Row']

export type ResolvedExercise = Exercise & {
    source: 'system' | 'custom'
    display_name: string
    hidden_at: string | null
    is_customized: boolean
    base_name: string
    base_modality: string | null
    base_muscle_group: string | null
}

// Extended types for joins
export type WorkoutExerciseWithExercise = WorkoutExercise & {
    exercises: ResolvedExercise
}

export type WorkoutWithExercises = Workout & {
    workout_exercises: WorkoutExerciseWithExercise[]
}

export type WorkoutSessionWithDetails = WorkoutSession & {
    workouts: Workout
    set_logs: (SetLog & { exercises: ResolvedExercise })[]
}
