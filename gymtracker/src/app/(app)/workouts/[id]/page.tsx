'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useLanguage } from '@/components/language-provider'
import type { Exercise, WorkoutExercise } from '@/lib/types'

type WorkoutExerciseWithDetails = WorkoutExercise & { exercises: Exercise }

export default function EditWorkoutPage() {
    const { t } = useLanguage()
    const params = useParams()
    const workoutId = params.id as string
    const router = useRouter()
    const { showToast } = useToast()
    const supabase = useSupabase()

    // Workout state
    const [workoutName, setWorkoutName] = useState('')
    const [originalName, setOriginalName] = useState('')
    const [loading, setLoading] = useState(true)

    // Workout exercises
    const [workoutExercises, setWorkoutExercises] = useState<WorkoutExerciseWithDetails[]>([])

    // Exercise library
    const [allExercises, setAllExercises] = useState<Exercise[]>([])

    // Add exercise UI
    const [showAddExercise, setShowAddExercise] = useState(false)
    const [newExerciseName, setNewExerciseName] = useState('')
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
    const [exerciseSearch, setExerciseSearch] = useState('')

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<WorkoutExerciseWithDetails | null>(null)

    const fetchData = useCallback(async () => {
        const [workoutRes, exercisesRes, allExercisesRes] = await Promise.all([
            supabase.from('workouts').select('*').eq('id', workoutId).single(),
            supabase
                .from('workout_exercises')
                .select('*, exercises(*)')
                .eq('workout_id', workoutId)
                .order('display_order'),
            supabase.from('exercises').select('*').order('name'),
        ])

        if (workoutRes.data) {
            setWorkoutName(workoutRes.data.name)
            setOriginalName(workoutRes.data.name)
        }
        setWorkoutExercises((exercisesRes.data as WorkoutExerciseWithDetails[]) || [])
        setAllExercises(allExercisesRes.data || [])
        setLoading(false)
    }, [supabase, workoutId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Save workout name
    async function handleSaveName() {
        if (workoutName.trim() === originalName) return
        const { error } = await supabase
            .from('workouts')
            .update({ name: workoutName.trim() })
            .eq('id', workoutId)
        if (error) {
            showToast(error.message, 'error')
        } else {
            setOriginalName(workoutName.trim())
            showToast('Name updated')
        }
    }

    // Add existing exercise from library
    async function handleAddExistingExercise() {
        if (!selectedExerciseId) return

        const nextOrder = workoutExercises.length
        const { error } = await supabase.from('workout_exercises').insert({
            workout_id: workoutId,
            exercise_id: selectedExerciseId,
            target_sets: 3,
            display_order: nextOrder,
        })

        if (error) {
            showToast(error.message, 'error')
        } else {
            showToast('Exercise added')
            setSelectedExerciseId(null)
            setShowAddExercise(false)
            setExerciseSearch('')
            fetchData()
        }
    }

    // Create new exercise and add to workout
    async function handleCreateAndAddExercise() {
        if (!newExerciseName.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Create the exercise
        const { data: exercise, error: createError } = await supabase
            .from('exercises')
            .insert({ user_id: user.id, name: newExerciseName.trim() })
            .select()
            .single()

        if (createError) {
            showToast(createError.message, 'error')
            return
        }

        // Add to workout
        const nextOrder = workoutExercises.length
        const { error: addError } = await supabase.from('workout_exercises').insert({
            workout_id: workoutId,
            exercise_id: exercise.id,
            target_sets: 3,
            display_order: nextOrder,
        })

        if (addError) {
            showToast(addError.message, 'error')
        } else {
            showToast(`"${exercise.name}" created & added`)
            setNewExerciseName('')
            setShowAddExercise(false)
            fetchData()
        }
    }

    // Update target sets
    async function handleUpdateSets(weId: string, newSets: number) {
        if (newSets < 1 || newSets > 20) return
        const { error } = await supabase
            .from('workout_exercises')
            .update({ target_sets: newSets })
            .eq('id', weId)
        if (error) {
            showToast(error.message, 'error')
        } else {
            setWorkoutExercises((prev) =>
                prev.map((we) => (we.id === weId ? { ...we, target_sets: newSets } : we))
            )
        }
    }

    // Remove exercise from workout
    async function handleRemoveExercise() {
        if (!deleteTarget) return
        const { error } = await supabase.from('workout_exercises').delete().eq('id', deleteTarget.id)
        if (error) {
            showToast(error.message, 'error')
        } else {
            showToast(`"${deleteTarget.exercises.name}" removed`)
            setWorkoutExercises((prev) => prev.filter((we) => we.id !== deleteTarget.id))
        }
        setDeleteTarget(null)
    }

    // Reorder exercise
    async function handleReorder(index: number, direction: 'up' | 'down') {
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === workoutExercises.length - 1)
        ) return

        const newExercises = [...workoutExercises]
        const swapIndex = direction === 'up' ? index - 1 : index + 1

        // Swap locally for instant UI
        const temp = newExercises[index]
        newExercises[index] = newExercises[swapIndex]
        newExercises[swapIndex] = temp

        // Update display_order property
        newExercises[index].display_order = index
        newExercises[swapIndex].display_order = swapIndex

        setWorkoutExercises(newExercises)

        // Sync to Supabase
        const { error: err1 } = await supabase
            .from('workout_exercises')
            .update({ display_order: index })
            .eq('id', newExercises[index].id)

        const { error: err2 } = await supabase
            .from('workout_exercises')
            .update({ display_order: swapIndex })
            .eq('id', newExercises[swapIndex].id)

        if (err1 || err2) {
            showToast('Failed to save order', 'error')
            fetchData() // Revert to DB state
        }
    }

    // Filter exercises not already in workout
    const availableExercises = allExercises.filter(
        (ex) =>
            !workoutExercises.some((we) => we.exercise_id === ex.id) &&
            ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
    )

    if (loading) {
        return (
            <div className="px-4 pt-6">
                <div className="h-8 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-6" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="px-4 pt-6 pb-8">
            {/* Back button */}
            <button
                onClick={() => router.push('/workouts')}
                className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors mb-4"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                {t('Workouts.back')}
            </button>

            {/* Workout name edit */}
            <div className="flex items-center gap-2 mb-6">
                <input
                    type="text"
                    value={workoutName}
                    onChange={(e) => setWorkoutName(e.target.value)}
                    onBlur={handleSaveName}
                    className="text-2xl font-bold text-zinc-900 dark:text-white bg-transparent border-b-2 border-transparent
            focus:border-violet-600 focus:outline-none transition-colors flex-1 py-1"
                />
            </div>

            {/* Exercises in workout */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">{t('Workouts.exercises')}</h2>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-600">{workoutExercises.length} {t('Workouts.itemsCount')}</span>
            </div>

            {workoutExercises.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-2xl p-8 text-center mb-4">
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-3">{t('Workouts.noExercises')}</p>
                </div>
            ) : (
                <div className="space-y-3 mb-4">
                    {workoutExercises.map((we, index) => (
                        <div
                            key={we.id}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 w-6 h-6
                      rounded-lg flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{we.exercises.name}</h3>
                                    </div>

                                    {/* Target sets stepper */}
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('Workouts.targetSets')}</span>
                                        <div className="flex items-center gap-0">
                                            <button
                                                onClick={() => handleUpdateSets(we.id, we.target_sets - 1)}
                                                disabled={we.target_sets <= 1}
                                                className="w-9 h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-l-xl flex items-center justify-center
                          hover:bg-zinc-700 disabled:opacity-30 active:scale-95 transition-all border border-zinc-300 dark:border-zinc-700"
                                            >
                                                −
                                            </button>
                                            <div className="w-10 h-9 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-white flex items-center justify-center
                        text-sm font-bold border-y border-zinc-300 dark:border-zinc-700">
                                                {we.target_sets}
                                            </div>
                                            <button
                                                onClick={() => handleUpdateSets(we.id, we.target_sets + 1)}
                                                disabled={we.target_sets >= 20}
                                                className="w-9 h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-r-xl flex items-center justify-center
                          hover:bg-zinc-700 disabled:opacity-30 active:scale-95 transition-all border border-zinc-300 dark:border-zinc-700"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleReorder(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1.5 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleReorder(index, 'down')}
                                            disabled={index === workoutExercises.length - 1}
                                            className="p-1.5 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(we)}
                                            className="p-1.5 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:text-red-400 transition-colors ml-1"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Exercise */}
            {showAddExercise ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 animate-[slideDown_0.2s_ease-out]">
                    <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-3">{t('Workouts.addExercise')}</h3>

                    {/* Search existing */}
                    <input
                        type="text"
                        value={exerciseSearch}
                        onChange={(e) => setExerciseSearch(e.target.value)}
                        placeholder={t('Workouts.searchExercises')}
                        className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
              placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600
              focus:border-transparent text-base mb-3"
                    />

                    {/* Existing exercise list */}
                    {availableExercises.length > 0 && (
                        <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                            {availableExercises.map((ex) => (
                                <button
                                    key={ex.id}
                                    onClick={() => {
                                        setSelectedExerciseId(ex.id)
                                        setNewExerciseName('')
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${selectedExerciseId === ex.id
                                        ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-800'
                                        }`}
                                >
                                    {ex.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-600">{t('Workouts.orCreateNew')}</span>
                        <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                    </div>

                    {/* Create new */}
                    <input
                        type="text"
                        value={newExerciseName}
                        onChange={(e) => {
                            setNewExerciseName(e.target.value)
                            setSelectedExerciseId(null)
                        }}
                        placeholder='e.g., "Incline Bench Smith"'
                        className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
              placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600
              focus:border-transparent text-base mb-3"
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setShowAddExercise(false)
                                setExerciseSearch('')
                                setSelectedExerciseId(null)
                                setNewExerciseName('')
                            }}
                            className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium rounded-xl
                hover:bg-zinc-700 transition-colors text-sm"
                        >
                            {t('Common.cancel')}
                        </button>
                        <button
                            onClick={selectedExerciseId ? handleAddExistingExercise : handleCreateAndAddExercise}
                            disabled={!selectedExerciseId && !newExerciseName.trim()}
                            className="flex-1 py-2.5 bg-violet-600 text-zinc-900 dark:text-white font-medium rounded-xl
                hover:bg-violet-500 transition-colors disabled:opacity-50 text-sm"
                        >
                            {selectedExerciseId ? t('Workouts.addSelected') : t('Workouts.createAndAdd')}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setShowAddExercise(true)}
                    className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium
            rounded-2xl hover:border-zinc-700 hover:text-zinc-400 transition-colors text-sm"
                >
                    + {t('Workouts.addExercise')}
                </button>
            )}

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={!!deleteTarget}
                title={t('Workouts.removeConfirmTitle')}
                description={t('Workouts.removeConfirmDesc').replace('{name}', deleteTarget?.exercises.name || '')}
                confirmLabel={t('Workouts.remove')}
                variant="danger"
                onConfirm={handleRemoveExercise}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    )
}
