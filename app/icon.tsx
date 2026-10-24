// app/icon.tsx: the browser-tab icon (favicon)
import { ImageResponse } from 'next/og'
import { BrandIcon } from '@/lib/brandIcon'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(<BrandIcon size={32} radius={0.22} glyph={0.7} />, { ...size })
}
