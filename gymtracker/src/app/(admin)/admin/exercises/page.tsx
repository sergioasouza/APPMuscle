import { AdminExercisesPageClient } from '@/features/admin/components/admin-exercises-page-client'
import { listAdminSystemExercises } from '@/features/admin/service'

export const metadata = {
    title: 'Admin • Exercícios base',
}

export default async function AdminExercisesPage() {
    const exercises = await listAdminSystemExercises()

    return <AdminExercisesPageClient initialExercises={exercises} />
}
