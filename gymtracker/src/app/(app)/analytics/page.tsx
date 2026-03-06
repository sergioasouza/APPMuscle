'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSupabase } from '@/lib/supabase/client'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from 'recharts'
import { useLanguage } from '@/components/language-provider'
import type { Workout, WorkoutSession, SetLog, WorkoutExercise, Exercise } from '@/lib/types'

type SessionWithTotals = WorkoutSession & {
    totalVolume: number
    totalSets: number
}

type WorkoutExerciseWithExercise = WorkoutExercise & { exercises: Exercise }

export default function AnalyticsPage() {
    const { t } = useLanguage()
    const supabase = useSupabase()
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)

    const [sessions, setSessions] = useState<SessionWithTotals[]>([])
    const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
    const [workoutExercises, setWorkoutExercises] = useState<WorkoutExerciseWithExercise[]>([])
    const [allSetLogs, setAllSetLogs] = useState<SetLog[]>([])

    const [loading, setLoading] = useState(true)
    const [loadingData, setLoadingData] = useState(false)
    const [viewMode, setViewMode] = useState<'chart' | 'table'>('table')

    const fetchWorkouts = useCallback(async () => {
        const { data } = await supabase.from('workouts').select('*').order('name')
        setWorkouts(data || [])
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        fetchWorkouts()
    }, [fetchWorkouts])

    useEffect(() => {
        if (selectedWorkoutId) {
            fetchWorkoutData(selectedWorkoutId)
        } else {
            setSessions([])
            setSelectedSessionIds([])
            setWorkoutExercises([])
            setAllSetLogs([])
        }
    }, [selectedWorkoutId])

    async function fetchWorkoutData(workoutId: string) {
        setLoadingData(true)

        // 1. Get exercises for this workout
        const { data: wExercises } = await supabase
            .from('workout_exercises')
            .select('*, exercises(*)')
            .eq('workout_id', workoutId)
            .order('display_order')
        setWorkoutExercises((wExercises as WorkoutExerciseWithExercise[]) || [])

        // 2. Get all sessions for this workout
        const { data: sessionData } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('workout_id', workoutId)
            .order('performed_at', { ascending: false }) // newest first

        if (!sessionData || sessionData.length === 0) {
            setSessions([])
            setSelectedSessionIds([])
            setAllSetLogs([])
            setLoadingData(false)
            return
        }

        const sessionIds = sessionData.map(s => s.id)

        // 3. Get all set logs for these sessions
        const { data: setLogsData } = await supabase
            .from('set_logs')
            .select('*')
            .in('session_id', sessionIds)

        setAllSetLogs(setLogsData || [])

        // 4. Aggregate totals
        const enrichedSessions = sessionData.map(session => {
            const sessionSets = (setLogsData || []).filter(s => s.session_id === session.id)
            const totalVolume = sessionSets.reduce((sum, set) => sum + (set.weight_kg * set.reps), 0)
            const totalSets = sessionSets.length
            return {
                ...session,
                totalVolume,
                totalSets
            }
        })

        setSessions(enrichedSessions)

        // Auto-select up to 2 most recent by default
        const defaultSelected = enrichedSessions.slice(0, 2).map(s => s.id).reverse()
        setSelectedSessionIds(defaultSelected)

        setLoadingData(false)
    }

    const toggleSessionSelection = (sessionId: string) => {
        setSelectedSessionIds(prev => {
            if (prev.includes(sessionId)) {
                return prev.filter(id => id !== sessionId)
            }
            if (prev.length >= 3) {
                // Remove the oldest selection (first in array) and add new
                return [...prev.slice(1), sessionId]
            }
            return [...prev, sessionId]
        })
    }

    const selectedSessions = useMemo(() => {
        // Return selected sessions sorted by date ascending
        return sessions
            .filter(s => selectedSessionIds.includes(s.id))
            .sort((a, b) => a.performed_at.localeCompare(b.performed_at))
    }, [sessions, selectedSessionIds])

    // Chart Data (Overall Volume of the selected sessions)
    const chartData = useMemo(() => {
        return selectedSessions.map(s => ({
            date: s.performed_at,
            volume: s.totalVolume,
            sets: s.totalSets
        }))
    }, [selectedSessions])

    const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId)

    if (loading) {
        return (
            <div className="px-4 pt-6">
                <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-6" />
                <div className="h-48 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
            </div>
        )
    }

    const CHART_COLORS = ['#8b5cf6', '#10b981', '#f59e0b']

    return (
        <div className="px-4 pt-6 pb-24">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">{t('Analytics.title')}</h1>

            {/* Workout selector */}
            <select
                value={selectedWorkoutId || ''}
                onChange={(e) => setSelectedWorkoutId(e.target.value || null)}
                className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white
          focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent
          text-base mb-4 appearance-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2371717a' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 6l3.5 4 3.5-4z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                }}
            >
                <option value="">{t('Analytics.selectWorkoutPlaceholder')}</option>
                {workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                        {w.name}
                    </option>
                ))}
            </select>

            {!selectedWorkoutId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[250px]">{t('Analytics.selectWorkoutPrompt')}</p>
                </div>
            ) : loadingData ? (
                <div className="space-y-4">
                    <div className="h-20 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                    <div className="h-64 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {t('Analytics.noDataFor')} <span className="font-semibold">{selectedWorkout?.name}</span>.
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 mt-1">{t('Analytics.completeWorkoutToCompare')}</p>
                </div>
            ) : (
                <>
                    {/* Session Picker */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{t('Analytics.selectSessions')}</h3>
                            <span className="text-xs font-medium text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full">
                                {selectedSessionIds.length}/3 {t('Analytics.maxSessions')}
                            </span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                            {sessions.map(s => {
                                const isSelected = selectedSessionIds.includes(s.id)
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => toggleSessionSelection(s.id)}
                                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${isSelected
                                            ? 'bg-violet-600/20 border-violet-500/50 text-zinc-900 dark:text-white shadow-[0_0_10px_rgba(139,92,246,0.1)]'
                                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-200'
                                            }`}
                                    >
                                        <div className="whitespace-nowrap">{s.performed_at}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {selectedSessions.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Analytics.pleaseSelectOne')}</p>
                        </div>
                    ) : (
                        <>
                            {/* View toggle */}
                            <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 mb-4">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'table'
                                        ? 'bg-violet-600 text-zinc-900 dark:text-white'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    📋 {t('Analytics.table')}
                                </button>
                                <button
                                    onClick={() => setViewMode('chart')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${viewMode === 'chart'
                                        ? 'bg-violet-600 text-zinc-900 dark:text-white'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    📊 {t('Analytics.chart')}
                                </button>
                            </div>

                            {viewMode === 'chart' ? (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-4">
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                                        {t('Analytics.totalVolume')}
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">{t('Analytics.aggregateIntensity')}</p>

                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fontSize: 10, fill: '#71717a' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(d) => {
                                                        const parts = d.split('-')
                                                        return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d
                                                    }}
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 10, fill: '#71717a' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={45}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#18181b',
                                                        border: '1px solid #27272a',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                    }}
                                                    cursor={{ fill: '#27272a', opacity: 0.4 }}
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    formatter={((value: any, name: any) => {
                                                        const v = Number(value)
                                                        if (name === 'volume') return [`${v.toLocaleString()} ${t('Today.kg')}`, t('Analytics.volume')]
                                                        return [v, name]
                                                    }) as any}
                                                />
                                                <Bar
                                                    dataKey="volume"
                                                    radius={[4, 4, 0, 0]}
                                                    maxBarSize={60}
                                                >
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : (
                                /* Table Comparison View */
                                <div className="space-y-3">
                                    {workoutExercises.map(we => (
                                        <div key={we.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden">
                                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/50">
                                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                    {we.exercises.name}
                                                </h3>
                                            </div>

                                            <div className="divide-y divide-zinc-800/30">
                                                {/* Table Header Row (Dates) */}
                                                <div className="flex bg-zinc-50 dark:bg-zinc-950/30">
                                                    <div className="w-12 shrink-0 border-r border-zinc-200 dark:border-zinc-800/30 flex items-center justify-center">
                                                        <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 dark:text-zinc-600">{t('Analytics.set')}</span>
                                                    </div>
                                                    {selectedSessions.map((session, sIdx) => (
                                                        <div key={session.id} className="flex-1 py-1 text-center border-r border-zinc-200 dark:border-zinc-800/30 last:border-0 relative">
                                                            <div
                                                                className="absolute top-0 left-0 right-0 h-0.5 opacity-50"
                                                                style={{ backgroundColor: CHART_COLORS[sIdx % CHART_COLORS.length] }}
                                                            />
                                                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                                                                {session.performed_at.split('-').slice(1).join('/')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Rows for Sets */}
                                                {Array.from({
                                                    length: Math.max(...selectedSessions.map(sess => {
                                                        return allSetLogs.filter(sl => sl.session_id === sess.id && sl.exercise_id === we.exercise_id).length
                                                    }), 1)
                                                }).map((_, rIdx) => {
                                                    const setNumber = rIdx + 1;
                                                    return (
                                                        <div key={rIdx} className="flex hover:bg-zinc-800/20 transition-colors">
                                                            <div className="w-12 shrink-0 py-2.5 border-r border-zinc-200 dark:border-zinc-800/30 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950/10">
                                                                <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400">{setNumber}</span>
                                                            </div>
                                                            {selectedSessions.map(session => {
                                                                // Find set for this session & exercise & setNumber
                                                                const sLog = allSetLogs.find(
                                                                    sl => sl.session_id === session.id &&
                                                                        sl.exercise_id === we.exercise_id &&
                                                                        sl.set_number === setNumber
                                                                )

                                                                return (
                                                                    <div key={session.id} className="flex-1 py-2.5 text-center border-r border-zinc-200 dark:border-zinc-800/30 last:border-0">
                                                                        {sLog ? (
                                                                            <div className="flex items-center justify-center gap-1 font-mono text-xs">
                                                                                <span className="text-zinc-900 dark:text-white font-medium">{sLog.weight_kg}</span>
                                                                                <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600">x</span>
                                                                                <span className="text-zinc-900 dark:text-white font-medium">{sLog.reps}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-zinc-700 text-xs">-</span>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    )
}
