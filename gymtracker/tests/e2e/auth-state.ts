import { resolve } from 'node:path'

export const memberStorageStatePath = resolve(__dirname, '.auth/member.json')
export const adminStorageStatePath = resolve(__dirname, '.auth/admin.json')
