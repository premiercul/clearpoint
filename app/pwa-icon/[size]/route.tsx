// app/pwa-icon/[size]/route.tsx: icons for the web app manifest: /pwa-icon/192, /pwa-icon/512, /pwa-icon/maskable
import { ImageResponse } from 'next/og'
import { BrandIcon } from '@/lib/brandIcon'

export const runtime = 'edge'

export function GET(_request: Request, { params }: { params: { size: string } }) {
  const maskable = params.size === 'maskable'
  const size = maskable ? 512 : Number(params.size)
  if (!maskable && size !== 192 && size !== 512) {
    return new Response('Not found', { status: 404 })
  }
  // Maskable icons are cropped into circles and rounded squares by Android, so they are full-bleed with a smaller letter.
  return new ImageResponse(<BrandIcon size={size} radius={maskable ? 0 : 0.2} glyph={maskable ? 0.42 : 0.62} />, {
    width: size,
    height: size,
  })
}
