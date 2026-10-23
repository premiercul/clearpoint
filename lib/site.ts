// lib/site.ts
// Set NEXT_PUBLIC_SITE_URL to your real address (e.g. https://clearpoint.ng) before deploying:
// canonical links, the sitemap and social previews are built from it.
export const SITE_NAME = 'ClearPoint'
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
export const SITE_TITLE = 'ClearPoint: collect payments and proof without WhatsApp screenshots'
export const SITE_DESCRIPTION =
  'One link for class dues, campus deliveries and pre-orders. People pay you directly and upload a receipt; you get a clean list to check and export.'

export const absoluteUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
