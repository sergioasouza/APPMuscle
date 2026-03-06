import type { LucideIcon } from 'lucide-react'
import {
    BarChart3,
    CalendarDays,
    CalendarRange,
    Dumbbell,
    UserRound,
    Zap,
} from 'lucide-react'

export type BottomNavKey =
    | 'today'
    | 'workouts'
    | 'schedule'
    | 'calendar'
    | 'analytics'
    | 'profile'

export interface BottomNavItem {
    key: BottomNavKey
    href: string
    icon: LucideIcon
}

export const bottomNavItems: BottomNavItem[] = [
    {
        key: 'today',
        href: '/today',
        icon: Zap,
    },
    {
        key: 'workouts',
        href: '/workouts',
        icon: Dumbbell,
    },
    {
        key: 'schedule',
        href: '/schedule',
        icon: CalendarRange,
    },
    {
        key: 'calendar',
        href: '/calendar',
        icon: CalendarDays,
    },
    {
        key: 'analytics',
        href: '/analytics',
        icon: BarChart3,
    },
    {
        key: 'profile',
        href: '/profile',
        icon: UserRound,
    },
]