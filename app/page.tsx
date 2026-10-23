// app/page.tsx (server component: metadata + structured data, then the interactive landing)
import type { Metadata } from 'next'
import Landing from '@/components/Landing'
import { JsonLd, faqLd, organizationLd, softwareLd, websiteLd } from '@/lib/seo'
import { FAQ } from '@/lib/content'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      <JsonLd data={softwareLd()} />
      <JsonLd data={faqLd(FAQ)} />
      <Landing />
    </>
  )
}
