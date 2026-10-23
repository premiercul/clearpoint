// app/robots.ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const PUBLIC = ['/', '/for/', '/privacy', '/llms.txt']
const PRIVATE = ['/dashboard', '/onboarding', '/super-admin', '/pay/', '/api/', '/auth/']

// AI search and answer engines are allowed on the public marketing pages only.
// To opt out of AI training but stay in AI search, remove GPTBot, ClaudeBot and Google-Extended here.
const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: PUBLIC, disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: PUBLIC, disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
