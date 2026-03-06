import 'server-only'

import { getProfilePageDataRepository, signOutRepository } from '@/features/profile/repository'

export async function getProfilePageData() {
    return getProfilePageDataRepository()
}

export async function signOut() {
    await signOutRepository()
}
