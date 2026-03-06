import { ProfilePageClient } from '@/features/profile/components/profile-page-client'
import { getProfilePageData } from '@/features/profile/service'

export default async function ProfilePage() {
    const initialData = await getProfilePageData()

    return <ProfilePageClient initialData={initialData} />
}
