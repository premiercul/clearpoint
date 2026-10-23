// app/layout.tsx
import './globals.css'
import type { Metadata, Viewport } from 'next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'class dues collection',
    'course manual payment',
    'campus delivery',
    'campus vendors',
    'payment receipt tracking',
    'class rep tools',
    'Nigeria university',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_NG',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="bg-white text-black antialiased selection:bg-black selection:text-white">
        {children}
      </body>
    </html>
  )
}
