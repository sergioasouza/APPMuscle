import 'server-only'

import { getProfilePageDataRepository } from '@/features/profile/repository'

export async function getProfilePageData() {
    return getProfilePageDataRepository()
}
