'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSupabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useLanguage } from '@/components/language-provider'
import { DAY_NAMES, formatDateISO } from '@/lib/utils'
import type { Workout, Exercise, WorkoutExercise, WorkoutSession, SetLog } from '@/lib/types'

type WorkoutExerciseWithExercise = WorkoutExercise & { exercises: Exercise }

interface ExerciseLogState {
    exerciseId: string
    exerciseName: string
    targetSets: number
    sets: { weight: string; reps: string; saved: boolean; id?: string }[]
}

function TodayContent() {
    const supabase = useSupabase()
    const { showToast } = useToast()
    const searchParams = useSearchParams()
    const { t } = useLanguage()

    // Parse historical date if provided
    const dateParam = searchParams.get('date')
    const today = dateParam ? new Date(dateParam + 'T00:00:00') : new Date()

    const dayOfWeek = today.getDay()
    const todayISO = formatDateISO(today)
    const isHistorical = !!dateParam

    const [loading, setLoading] = useState(true)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [workoutExercises, setWorkoutExercises] = useState<WorkoutExerciseWithExercise[]>([])
    const [session, setSession] = useState<WorkoutSession | null>(null)
    const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogState[]>([])
    const [notes, setNotes] = useState('')
    const [savingNotes, setSavingNotes] = useState(false)

    // Override State
    const [showOverrideModal, setShowOverrideModal] = useState(false)
    const [allWorkouts, setAllWorkouts] = useState<Workout[]>([])
    const [showRescheduleModal, setShowRescheduleModal] = useState(false)

    const fetchData = useCallback(async () => {
        // Get today's schedule
        const { data: scheduleData } = await supabase
            .from('schedule')
            .select('*, workouts(*)')
            .eq('day_of_week', dayOfWeek)
            .single()

        if (!scheduleData) {
            setLoading(false)
            return
        }

        const workoutData = (scheduleData as any).workouts as Workout
        setWorkout(workoutData)

        // Get exercises for this workout
        const { data: wExercises } = await supabase
            .from('workout_exercises')
            .select('*, exercises(*)')
            .eq('workout_id', workoutData.id)
            .order('display_order')

        const exerciseList = (wExercises as WorkoutExerciseWithExercise[]) || []
        setWorkoutExercises(exerciseList)

        // Check for existing session today
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let sessionData: WorkoutSession | null = null
        // Find ANY session for today (could be the scheduled one, or an override)
        const { data: existingSession } = await supabase
            .from('workout_sessions')
            .select('*, workouts(*)')
            .eq('performed_at', todayISO)
            .single()

        // What workout are we actually doing today?
        let activeWorkoutData = workoutData

        if (existingSession) {
            sessionData = existingSession
            // If the existing session is for a different workout, override the active one
            if (existingSession.workout_id !== workoutData?.id) {
                activeWorkoutData = (existingSession as any).workouts as Workout
                setWorkout(activeWorkoutData)

                // Need to fetch exercises for the overridden workout
                const { data: overrideExercises } = await supabase
                    .from('workout_exercises')
                    .select('*, exercises(*)')
                    .eq('workout_id', activeWorkoutData.id)
                    .order('display_order')

                const ovList = (overrideExercises as WorkoutExerciseWithExercise[]) || []
                setWorkoutExercises(ovList)
                // Need to use ovList for logs building instead of exerciseList
            }
        } else if (workoutData) {
            // Create new session for today based on schedule
            const { data: newSession } = await supabase
                .from('workout_sessions')
                .insert({
                    user_id: user.id,
                    workout_id: workoutData.id,
                    performed_at: todayISO,
                })
                .select()
                .single()
            sessionData = newSession
        }

        if (sessionData && activeWorkoutData) {
            setSession(sessionData)
            setNotes(sessionData.notes || '')

            // Re-eval which exercise list to iterate over
            const currentExecList = existingSession && existingSession.workout_id !== workoutData?.id
                ? (workoutExercises.length > 0 ? workoutExercises : []) // Fallback, will be populated next render 
                : exerciseList

            // But we actually need to fetch them cleanly here if we overrode it
            let finalExerciseList = exerciseList
            if (existingSession && existingSession.workout_id !== workoutData?.id) {
                const { data: overrideExercises } = await supabase
                    .from('workout_exercises')
                    .select('*, exercises(*)')
                    .eq('workout_id', activeWorkoutData.id)
                    .order('display_order')
                finalExerciseList = (overrideExercises as WorkoutExerciseWithExercise[]) || []
                setWorkoutExercises(finalExerciseList)
            }

            // Get existing set logs
            const { data: setLogs } = await supabase
                .from('set_logs')
                .select('*')
                .eq('session_id', sessionData.id)
                .order('set_number')

            // Build exercise log state using finalExerciseList
            const logs: ExerciseLogState[] = finalExerciseList.map((we) => {
                const existingSets = (setLogs || []).filter(
                    (sl) => sl.exercise_id === we.exercise_id
                )

                const sets = Array.from({ length: we.target_sets }, (_, i) => {
                    const existingSet = existingSets.find((s) => s.set_number === i + 1)
                    return {
                        weight: existingSet ? String(existingSet.weight_kg) : '',
                        reps: existingSet ? String(existingSet.reps) : '',
                        saved: !!existingSet,
                        id: existingSet?.id,
                    }
                })

                return {
                    exerciseId: we.exercise_id,
                    exerciseName: we.exercises.name,
                    targetSets: we.target_sets,
                    sets,
                }
            })

            setExerciseLogs(logs)
        }

        setLoading(false)
    }, [supabase, dayOfWeek, todayISO])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Load all workouts for the override modal
    async function loadAllWorkouts() {
        const { data } = await supabase.from('workouts').select('*').order('name')
        if (data) setAllWorkouts(data)
    }

    // Switch workout for today
    async function handleSwitchWorkout(newWorkoutId: string) {
        if (!session && !workout) {
            // It was a rest day, create a new session
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { error } = await supabase.from('workout_sessions').insert({
                user_id: user.id,
                workout_id: newWorkoutId,
                performed_at: todayISO,
            })
            if (error) showToast(error.message, 'error')
        } else if (session) {
            // Update the existing session to point to the new workout
            // This leaves the old set_logs orphaned (they cascade delete if we delete the session, 
            // but just updating the workout_id means we should manually clean up set logs for the old workout)
            await supabase.from('set_logs').delete().eq('session_id', session.id)

            const { error } = await supabase
                .from('workout_sessions')
                .update({ workout_id: newWorkoutId })
                .eq('id', session.id)
            if (error) showToast(error.message, 'error')
        }

        setShowOverrideModal(false)
        setLoading(true)
        fetchData()
    }

    // Skip workout
    async function handleSkipWorkout() {
        if (!session) return

        await supabase.from('set_logs').delete().eq('session_id', session.id)
        const { error } = await supabase
            .from('workout_sessions')
            .update({ notes: '[SKIPPED] ' + (session.notes || '') })
            .eq('id', session.id)

        if (error) showToast(error.message, 'error')
        else showToast('Workout skipped for today')

        setShowOverrideModal(false)
        setLoading(true)
        fetchData()
    }

    // Undo Skip
    async function handleUndoSkip() {
        if (!session) return
        const newNotes = session.notes?.replace('[SKIPPED] ', '') || null
        const { error } = await supabase
            .from('workout_sessions')
            .update({ notes: newNotes })
            .eq('id', session.id)

        if (error) showToast(error.message, 'error')

        setLoading(true)
        fetchData()
    }

    // Reschedule workout
    async function handleReschedule(targetDay: number) {
        if (!workout) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Calculate the target date within the current/next week
        const targetDateObj = new Date(today)
        let diff = targetDay - today.getDay()
        if (diff <= 0) diff += 7 // Move to next occurrence of that day (tomorrow or next week)
        targetDateObj.setDate(today.getDate() + diff)
        const targetDateISO = formatDateISO(targetDateObj)

        // 2. Clear today's progress if any, and set today as skipped/rescheduled
        if (session) {
            await supabase.from('set_logs').delete().eq('session_id', session.id)
            await supabase.from('workout_sessions').update({
                notes: `[RESCHEDULED TO ${DAY_NAMES[targetDay]}]`
            }).eq('id', session.id)
        } else {
            await supabase.from('workout_sessions').insert({
                user_id: user.id,
                workout_id: workout.id,
                performed_at: todayISO,
                notes: `[RESCHEDULED TO ${DAY_NAMES[targetDay]}]`
            })
        }

        // 3. Pre-create the session on the target date
        await supabase.from('workout_sessions').delete().eq('performed_at', targetDateISO).eq('user_id', user.id)
        await supabase.from('workout_sessions').insert({
            user_id: user.id,
            workout_id: workout.id,
            performed_at: targetDateISO,
            notes: `[RESCHEDULED FROM ${DAY_NAMES[dayOfWeek]}]`
        })

        showToast(`Workout moved to ${DAY_NAMES[targetDay]}`)
        setShowRescheduleModal(false)
        setLoading(true)
        fetchData()
    }

    async function handleSaveSet(exerciseIndex: number, setIndex: number) {
        if (!session) return
        const exerciseLog = exerciseLogs[exerciseIndex]
        const set = exerciseLog.sets[setIndex]
        const weight = parseFloat(set.weight)
        const reps = parseInt(set.reps)

        if (isNaN(weight) || isNaN(reps) || weight < 0 || reps < 1) {
            showToast('Enter valid weight and reps', 'error')
            return
        }

        if (set.saved && set.id) {
            // Update existing
            const { error } = await supabase
                .from('set_logs')
                .update({ weight_kg: weight, reps })
                .eq('id', set.id)
            if (error) {
                showToast(error.message, 'error')
                return
            }
        } else {
            // Insert new
            const { data, error } = await supabase
                .from('set_logs')
                .insert({
                    session_id: session.id,
                    exercise_id: exerciseLog.exerciseId,
                    set_number: setIndex + 1,
                    weight_kg: weight,
                    reps,
                })
                .select()
                .single()
            if (error) {
                showToast(error.message, 'error')
                return
            }
            if (data) {
                set.id = data.id
            }
        }

        // Update state
        const newLogs = [...exerciseLogs]
        newLogs[exerciseIndex].sets[setIndex] = {
            ...set,
            saved: true,
            weight: String(weight),
            reps: String(reps),
        }
        setExerciseLogs(newLogs)
        showToast(`Set ${setIndex + 1} saved ✓`)
    }

    function handleSetChange(
        exerciseIndex: number,
        setIndex: number,
        field: 'weight' | 'reps',
        value: string
    ) {
        const newLogs = [...exerciseLogs]
        newLogs[exerciseIndex].sets[setIndex] = {
            ...newLogs[exerciseIndex].sets[setIndex],
            [field]: value,
            saved: false,
        }
        setExerciseLogs(newLogs)
    }

    async function handleSaveNotes() {
        if (!session) return
        setSavingNotes(true)
        const { error } = await supabase
            .from('workout_sessions')
            .update({ notes: notes.trim() || null })
            .eq('id', session.id)
        if (error) {
            showToast(error.message, 'error')
        } else {
            showToast('Notes saved')
        }
        setSavingNotes(false)
    }

    // Calculate completion
    const totalSets = exerciseLogs.reduce((acc, el) => acc + el.targetSets, 0)
    const completedSets = exerciseLogs.reduce(
        (acc, el) => acc + el.sets.filter((s) => s.saved).length,
        0
    )
    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0

    if (loading) {
        return (
            <div className="px-4 pt-6">
                <div className="h-8 w-40 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-2" />
                <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-40 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    // Rest day
    if (!workout) {
        return (
            <div className="px-4 pt-6">
                {isHistorical && (
                    <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        {t('Today.historicalView')}
                    </div>
                )}
                <div className="flex items-center justify-between mb-1">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{DAY_NAMES[dayOfWeek]}</h1>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{isHistorical ? t('Today.historical') : t('Today.today')} • {todayISO}</p>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center mb-4">
                        <span className="text-3xl">😴</span>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{t('Today.restDay')}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[250px] mb-6">
                        {t('Today.noWorkout')}
                    </p>
                    <button
                        onClick={() => {
                            loadAllWorkouts()
                            setShowOverrideModal(true)
                        }}
                        className="px-6 py-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800
                        hover:bg-zinc-800 transition-colors"
                    >
                        {t('Today.startAnyway')}
                    </button>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 mt-4">
                        {t('Today.changeSchedule')}
                    </p>
                </div>

                {showOverrideModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.selectWorkout')}</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{t('Today.chooseWorkout')}</p>

                            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                                {allWorkouts.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => handleSwitchWorkout(w.id)}
                                        className="w-full text-left px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium hover:bg-zinc-800 transition-colors"
                                    >
                                        {w.name}
                                    </button>
                                ))}
                                {allWorkouts.length === 0 && (
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-4">{t('Today.noWorkouts')}</p>
                                )}
                            </div>

                            <button
                                onClick={() => setShowOverrideModal(false)}
                                className="w-full py-3.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors"
                            >
                                {t('Common.cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const isSkipped = session?.notes?.startsWith('[SKIPPED]')

    if (isSkipped) {
        return (
            <div className="px-4 pt-6">
                {isHistorical && (
                    <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        {t('Today.historicalView')}
                    </div>
                )}
                <div className="flex items-center justify-between mb-1">
                    <h1 className="text-2xl font-bold text-zinc-500 dark:text-zinc-400 opacity-50 line-through">{workout.name}</h1>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{isHistorical ? t('Today.historical') : t('Today.today')} • {todayISO}</p>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-3xl opacity-50">🛋️</span>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{t('Today.workoutSkipped')}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[250px] mb-6">
                        {t('Today.youChoseToRest')}
                    </p>
                    <button
                        onClick={handleUndoSkip}
                        className="px-6 py-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-800 transition-colors"
                    >
                        {t('Today.undoSkip')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="px-4 pt-6 pb-8">
            {isHistorical && (
                <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                    {t('Today.historicalView')}
                </div>
            )}
            {/* Header */}
            <div className="flex items-start justify-between mb-0.5">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{workout.name}</h1>
                <button
                    onClick={() => {
                        loadAllWorkouts()
                        setShowOverrideModal(true)
                    }}
                    className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-white bg-white dark:bg-zinc-900 rounded-full transition-colors"
                    title={t('Today.switchWorkout')}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </button>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                {DAY_NAMES[dayOfWeek]} • {todayISO}
            </p>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('Today.progress')}</span>
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        {completedSets}/{totalSets} {t('Today.sets')}
                    </span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                {progress === 100 && (
                    <p className="text-xs text-emerald-400 font-semibold mt-1.5 text-center">
                        🎉 Workout complete!
                    </p>
                )}
            </div>

            {/* Exercise cards */}
            <div className="space-y-4">
                {exerciseLogs.map((exerciseLog, exIndex) => {
                    const exCompleted = exerciseLog.sets.filter((s) => s.saved).length
                    return (
                        <div
                            key={exerciseLog.exerciseId}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden"
                        >
                            {/* Exercise header */}
                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{exerciseLog.exerciseName}</h3>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${exCompleted === exerciseLog.targetSets
                                    ? 'bg-emerald-600/20 text-emerald-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                    }`}>
                                    {exCompleted}/{exerciseLog.targetSets}
                                </span>
                            </div>

                            {/* Set rows */}
                            <div className="divide-y divide-zinc-800/30">
                                {exerciseLog.sets.map((set, setIndex) => (
                                    <div
                                        key={setIndex}
                                        className={`px-4 py-3 flex items-center gap-3 ${set.saved ? 'bg-zinc-100 dark:bg-zinc-800/20' : ''
                                            }`}
                                    >
                                        {/* Set number */}
                                        <span className={`text-xs font-bold w-6 text-center ${set.saved ? 'text-emerald-400' : 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-600'
                                            }`}>
                                            {set.saved ? '✓' : setIndex + 1}
                                        </span>

                                        {/* Weight input */}
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step="0.5"
                                                value={set.weight}
                                                onChange={(e) => handleSetChange(exIndex, setIndex, 'weight', e.target.value)}
                                                placeholder="0"
                                                className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
                          text-center text-base font-semibold placeholder-zinc-600
                          focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
                                            />
                                            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-center block mt-0.5">{t('Today.kg')}</span>
                                        </div>

                                        {/* × separator */}
                                        <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-sm font-bold">×</span>

                                        {/* Reps input */}
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={set.reps}
                                                onChange={(e) => handleSetChange(exIndex, setIndex, 'reps', e.target.value)}
                                                placeholder="0"
                                                className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
                          text-center text-base font-semibold placeholder-zinc-600
                          focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
                                            />
                                            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-center block mt-0.5">{t('Today.reps')}</span>
                                        </div>

                                        {/* Save button */}
                                        <button
                                            onClick={() => handleSaveSet(exIndex, setIndex)}
                                            disabled={!set.weight || !set.reps}
                                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95
                        min-w-[60px] ${set.saved
                                                    ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                                                    : 'bg-violet-600 text-zinc-900 dark:text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed'
                                                }`}
                                        >
                                            {set.saved ? t('Common.edit') : t('Common.save')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Session notes */}
            {session && (
                <div className="mt-6 mb-8">
                    <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                        {t('Today.sessionNotes')}
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={handleSaveNotes}
                        placeholder={t('Today.sessionNotesPlaceholder')}
                        rows={3}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white
              placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600
              focus:border-transparent text-sm resize-none"
                    />
                    <p className="text-[10px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 mt-1">{t('Today.autoSaves')}</p>
                </div>
            )}

            {/* Override Modal (Active Day) */}
            {showOverrideModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.switchWorkout')}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{t('Today.doingSomethingElse')}</p>

                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {allWorkouts.map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => handleSwitchWorkout(w.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${w.id === workout.id
                                        ? 'bg-violet-600/20 text-violet-400 border border-violet-600/50'
                                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-800'
                                        }`}
                                >
                                    {w.name} {w.id === workout.id && t('Today.current')}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                onClick={() => {
                                    setShowOverrideModal(false)
                                    setShowRescheduleModal(true)
                                }}
                                className="py-3 bg-emerald-600/10 text-emerald-500 font-semibold rounded-xl hover:bg-emerald-600/20 transition-colors text-sm"
                            >
                                {t('Today.reschedule')}
                            </button>
                            <button
                                onClick={handleSkipWorkout}
                                className="py-3 bg-red-500/10 text-red-400 font-semibold rounded-xl hover:bg-red-500/20 transition-colors text-sm"
                            >
                                {t('Today.skipWorkout')}
                            </button>
                        </div>

                        <button
                            onClick={() => setShowOverrideModal(false)}
                            className="w-full py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors"
                        >
                            {t('Common.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Reschedule Modal */}
            {showRescheduleModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.rescheduleWorkout')}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{t('Today.rescheduleDesc')}</p>

                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                                if (dayIndex === dayOfWeek) return null
                                return (
                                    <button
                                        key={dayIndex}
                                        onClick={() => handleReschedule(dayIndex)}
                                        className="py-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800"
                                    >
                                        {DAY_NAMES[dayIndex]}
                                    </button>
                                )
                            })}
                        </div>

                        <button
                            onClick={() => setShowRescheduleModal(false)}
                            className="w-full py-3.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors"
                        >
                            {t('Common.cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function TodayPage() {
    return (
        <Suspense fallback={
            <div className="px-4 pt-6 space-y-6 animate-pulse">
                <div className="h-24 bg-zinc-800 rounded-2xl" />
                <div className="h-48 bg-zinc-800 rounded-2xl" />
            </div>
        }>
            <TodayContent />
        </Suspense>
    )
}
