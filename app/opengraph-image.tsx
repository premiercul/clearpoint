// app/opengraph-image.tsx: the preview card shown when the site is shared on WhatsApp, X, LinkedIn...
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ClearPoint: collect payments and proof without WhatsApp screenshots'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#000000',
          color: '#ffffff',
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>ClearPoint</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            Stop sorting WhatsApp screenshots.
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: '#9ca3af', marginTop: 28 }}>
            One link for class dues, campus deliveries and pre-orders.
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
