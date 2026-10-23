// app/for/[slug]/page.tsx
// Static pages for each audience. They target the searches people actually make ("how do I collect
// class dues") and give search engines and AI answer engines clear, factual, answer-first content.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SignInButton from '@/components/SignInButton'
import { JsonLd, breadcrumbLd, faqLd } from '@/lib/seo'
import { PERSONAS, PERSONA_ORDER, type PersonaSlug } from '@/lib/content'
import { SITE_NAME } from '@/lib/site'

export const dynamicParams = false

export function generateStaticParams() {
  return PERSONA_ORDER.map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = PERSONAS[params.slug as PersonaSlug]
  if (!p) return {}
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/for/${p.slug}` },
    openGraph: { type: 'website', title: p.title, description: p.description, url: `/for/${p.slug}` },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description },
  }
}

export default function PersonaPage({ params }: { params: { slug: string } }) {
  const p = PERSONAS[params.slug as PersonaSlug]
  if (!p) notFound()

  return (
    <main className="min-h-screen bg-white text-black">
      <JsonLd data={faqLd(p.faq)} />
      <JsonLd
        data={breadcrumbLd([
          { name: SITE_NAME, path: '/' },
          { name: p.navLabel, path: `/for/${p.slug}` },
        ])}
      />

      <nav aria-label="Main" className="w-full px-6 sm:px-10 py-6 flex justify-between items-center">
        <Link href="/" className="font-bold tracking-tight text-lg">
          {SITE_NAME}
        </Link>
        <SignInButton className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-gray-800 transition-colors">
          Sign In
        </SignInButton>
      </nav>

      <article className="max-w-3xl mx-auto px-6 pb-16 space-y-12">
        <header className="space-y-5 pt-6">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">{p.h1}</h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">{p.intro}</p>
          <SignInButton>Create your first link →</SignInButton>
        </header>

        <section aria-labelledby="problems" className="space-y-3">
          <h2 id="problems" className="text-xl font-bold tracking-tight">
            Sound familiar?
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700">
            {p.problems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how" className="space-y-4">
          <h2 id="how" className="text-xl font-bold tracking-tight">
            How it works
          </h2>
          <ol className="space-y-4">
            {p.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-black text-white text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-sm">{step.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="gets" className="space-y-3">
          <h2 id="gets" className="text-xl font-bold tracking-tight">
            What you get
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700">
            {p.gets.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="text-sm text-gray-600">
            ClearPoint never holds or moves money. Payers transfer straight to your account, and they do not need an
            account to use your link.
          </p>
        </section>

        <section aria-labelledby="faq" className="space-y-3">
          <h2 id="faq" className="text-xl font-bold tracking-tight">
            Questions
          </h2>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {p.faq.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none flex justify-between items-center gap-4 text-sm font-semibold">
                  {item.q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="pt-6 border-t border-gray-100 text-xs text-gray-500 space-y-3">
          <nav aria-label="Other audiences" className="flex flex-wrap gap-x-4 gap-y-1">
            {PERSONA_ORDER.filter((s) => s !== p.slug).map((s) => (
              <Link key={s} href={`/for/${s}`} className="hover:underline">
                For {PERSONAS[s].navLabel.toLowerCase()}
              </Link>
            ))}
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </nav>
        </footer>
      </article>
    </main>
  )
}
