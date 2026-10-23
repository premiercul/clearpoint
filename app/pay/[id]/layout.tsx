import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment page',
  robots: { index: false, follow: false, nocache: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
