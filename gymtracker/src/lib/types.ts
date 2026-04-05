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
                    created_at: string
                }
                Insert: {
                    id: string
                    display_name: string
                    rotation_anchor_date?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    display_name?: string
                    rotation_anchor_date?: string | null
                    created_at?: string
                }
                Relationships: []
            }
            exercises: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    archived_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    archived_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
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
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row']
export type Schedule = Database['public']['Tables']['schedule']['Row']
export type ScheduleRotation = Database['public']['Tables']['schedule_rotations']['Row']
export type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row']
export type SetLog = Database['public']['Tables']['set_logs']['Row']
export type BodyMeasurement = Database['public']['Tables']['body_measurements']['Row']

// Extended types for joins
export type WorkoutExerciseWithExercise = WorkoutExercise & {
    exercises: Exercise
}

export type WorkoutWithExercises = Workout & {
    workout_exercises: WorkoutExerciseWithExercise[]
}

export type WorkoutSessionWithDetails = WorkoutSession & {
    workouts: Workout
    set_logs: (SetLog & { exercises: Exercise })[]
}
