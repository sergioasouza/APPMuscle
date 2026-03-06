import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gymtracker.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/login',
    '/today',
    '/workouts',
    '/schedule',
    '/calendar',
    '/analytics',
    '/profile',
  ]

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/today' ? 'daily' : 'weekly',
    priority: route === '' || route === '/today' ? 1 : 0.7,
  }))
}
