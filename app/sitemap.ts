// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { PERSONA_ORDER } from '@/lib/content'
import { absoluteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'monthly', priority: 1 },
    ...PERSONA_ORDER.map((slug) => ({
      url: absoluteUrl(`/for/${slug}`),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: absoluteUrl('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
