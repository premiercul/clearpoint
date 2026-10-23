// app/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import PromoBanner from '@/components/PromoBanner'
import { FAQ, PERSONAS } from '@/lib/content'
import Link from 'next/link'

const WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '').replace(/\D/g, '')

const SITUATIONS = [
  {
    who: 'Class rep',
    href: '/for/class-reps',
    problem:
      'Manual money is due Friday. Transfers and screenshots are scattered across three chats and you can’t tell who hasn’t paid.',
    fix: 'One link, one list. Every payer’s details and receipt land in the same table.',
  },
  {
    who: 'Campus delivery runner',
    href: '/for/delivery-runners',
    problem:
      'Between lectures, ten orders land in the group chat: food, printing, pharmacy runs. Who wants what, how much, and which department or lecture hall is it going to?',
    fix: 'Each order arrives with its drop-off point, item cost and your fee already added up. Plan your route and tick off each delivery.',
  },
  {
    who: 'Campus vendor',
    href: '/for/campus-vendors',
    problem: 'Pre-orders for the thrift drop arrive as DMs, with items, sizes and proof buried in the thread.',
    fix: 'Customers choose how many, and you get a clean order list with totals.',
  },
  {
    who: 'Dues or event organiser',
    problem: 'Dinner, jerseys, a group project. Everyone owes something and nobody keeps a proper list.',
    fix: 'Share the link once and see who has paid at a glance.',
  },
]

const STEPS = [
  {
    title: 'Create a link',
    body: 'Choose how people pay: one fixed amount, your delivery fee plus the item cost, or a price list. Then add your account number and what to collect: name, department, drop-off point, a payment receipt.',
  },
  {
    title: 'Share it on WhatsApp',
    body: 'Paste the link in your group or status. Payers open it on their phone and don’t need an account.',
  },
  {
    title: 'Check, tick off, export',
    body: 'Each payer pays you directly and uploads their receipt. You compare it with your bank alert, mark it verified or flagged, and tick off delivered.',
  },
]

const TRUST = [
  { title: 'We never hold your money', body: 'Payers transfer straight to your account. ClearPoint only records the details and proof.' },
  { title: 'Receipts stay private', body: 'Receipt images are visible only to whoever created the link, never public.' },
  { title: 'No account for payers', body: 'They open your link, fill in the form and upload a screenshot. That’s all.' },
  { title: 'Built for low data', body: 'Receipt images are shrunk on the phone before they upload, so they use far less data.' },
]

const MOCKS = {
  rep: {
    tab: 'Class rep',
    title: 'GST 111 Manual',
    lines: [] as string[][],
    total: '₦2,000',
    fields: ['Full Name', 'Matric Number', 'Upload Payment Receipt Screenshot'],
    tableTitle: 'GST 111 Manual',
    meta: '4 submissions · ₦2,000 each',
    cols: ['Name', 'Matric', 'Expected', 'Status', 'Done'],
    rows: [
      ['Chidi A.', '21/0412', '₦2,000', 'verified', 'Done'],
      ['Fatima B.', '21/0987', '₦2,000', 'verified', 'Done'],
      ['Tunde O.', '22/0150', '₦2,000', 'pending', 'Pending'],
      ['Grace E.', '21/0412', '₦2,000', 'flagged', 'Pending'],
    ],
    note: 'Sample data. Repeated matric numbers are highlighted so you can catch double entries.',
  },
  runner: {
    tab: 'Delivery runner',
    title: 'Campus Runs · 12pm to 4pm',
    lines: [
      ['Delivery fee', '₦300'],
      ['Items', '₦1,500'],
    ],
    total: '₦1,800',
    fields: [
      'Drop-off point: Faculty of Science',
      'Exact spot: LT2, back row',
      'What should we buy?',
      'Upload Payment Receipt Screenshot',
    ],
    tableTitle: 'Run board · grouped by drop-off point',
    meta: '4 orders · items to buy ₦5,400 · your fees ₦1,200',
    cols: ['Drop-off', 'Name', 'Items', 'Total', 'Status', 'Delivered'],
    rows: [
      ['Faculty of Science', 'Ada O.', '₦1,500', '₦1,800', 'verified', 'Pending'],
      ['Faculty of Science', 'Musa K.', '₦900', '₦1,200', 'verified', 'Pending'],
      ['Main Library', 'Ife T.', '₦2,100', '₦2,400', 'pending', 'Pending'],
      ['Admin Block', 'Bola S.', '₦900', '₦1,200', 'verified', 'Done'],
    ],
    note: 'Sample data. Orders are grouped by drop-off point so you can plan your route across campus.',
  },
  vendor: {
    tab: 'Vendor',
    title: 'Denim Jacket · Saturday drop',
    lines: [['2 × Denim jacket', '₦12,000']],
    total: '₦12,000',
    fields: ['Full Name', 'Pickup point on campus', 'Upload Payment Receipt Screenshot'],
    tableTitle: 'Orders · Denim jacket',
    meta: '3 orders · 4 to prepare · ₦24,000',
    cols: ['Name', 'Pickup point', 'Qty', 'Total', 'Status'],
    rows: [
      ['Ada O.', 'Faculty of Arts', '2', '₦12,000', 'verified'],
      ['Musa K.', 'Library', '1', '₦6,000', 'verified'],
      ['Ife T.', 'Admin Block', '1', '₦6,000', 'pending'],
    ],
    note: 'Sample data. One link per product; quantities add up for you.',
  },
}
type MockKey = keyof typeof MOCKS

export default function Landing() {
  const supabase = createClientComponentClient()
  const [error, setError] = useState('')
  const [mockKey, setMockKey] = useState<MockKey>('rep')
  const m = MOCKS[mockKey]

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'auth') {
      setError('Sign-in did not complete. Please try again.')
    }
  }, [])

  const handleSignIn = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError('Error logging in with Google. Please try again.')
  }

  return (
    <main className="min-h-screen bg-white text-black flex flex-col scroll-smooth">
      {/* Navbar */}
      <nav className="w-full px-6 sm:px-10 py-6 flex justify-between items-center">
        <div className="font-bold tracking-tight text-lg">ClearPoint</div>
        <div className="flex items-center gap-5">
          <a href="#how-it-works" className="hidden sm:inline text-xs font-medium text-gray-600 hover:text-black">
            How it works
          </a>
          <button
            onClick={handleSignIn}
            className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center space-y-6">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
          Stop sorting WhatsApp screenshots.
        </h1>

        <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto">
          Share one link. People pay you directly, drop their details and receipt, and you get a clean list to tick off
          and export.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
          <button
            onClick={handleSignIn}
            className="w-full sm:w-auto px-6 py-3.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
          >
            Create your first link →
          </button>
          <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-black hover:underline">
            See how it works
          </a>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}

        <p className="text-xs text-gray-500">
          Payers don’t need an account · Money goes straight to you · Works on low data
        </p>
        <p className="text-xs text-gray-500">
          One fixed price, your delivery fee plus item cost, or a price list. You choose.
        </p>
      </section>

      {/* Sponsored banner (renders nothing when no promotion is live) */}
      <PromoBanner placement="landing" className="w-full px-6 sm:px-10 pb-10" />

      {/* Moments of need */}
      <section className="w-full px-6 sm:px-10 py-14 border-t border-gray-100">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Sound familiar?</h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {SITUATIONS.map((s) => (
            <div key={s.who} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-4">
              <h3 className="font-semibold text-sm">{s.who}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{s.problem}</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-auto pt-4 border-t border-gray-200">{s.fix}</p>
              {'href' in s && s.href && (
                <Link href={s.href} className="text-xs font-semibold text-black hover:underline">
                  Learn more →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="w-full px-6 sm:px-10 py-14 border-t border-gray-100 scroll-mt-4">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="p-6 rounded-2xl border border-gray-200 flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-400">Step {i + 1}</span>
              <h3 className="font-semibold text-base">{step.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* See it */}
      <section className="w-full px-6 sm:px-10 py-14 border-t border-gray-100">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">What your payers and you see</h2>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Example">
          {(Object.keys(MOCKS) as MockKey[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={mockKey === k}
              onClick={() => setMockKey(k)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                mockKey === k ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {MOCKS[k].tab}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
          {/* Payer's phone */}
          <div
            aria-hidden="true"
            className="mx-auto w-full max-w-[320px] rounded-[2rem] border-4 border-gray-900 bg-gray-50 p-4 space-y-3"
          >
            <p className="text-center text-sm font-bold">{m.title}</p>
            <div className="bg-black text-white rounded-2xl p-4 space-y-1">
              <p className="text-[10px] text-gray-400">Amount to transfer</p>
              <p className="text-lg font-bold">{m.total}</p>
              <p className="text-sm font-mono">0123456789</p>
              <p className="text-[11px] text-gray-300">Ada Obi · OPay</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
              {m.lines.length > 0 && (
                <div className="text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 space-y-0.5">
                  {m.lines.map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-black pt-0.5 border-t border-gray-200">
                    <span>Total</span>
                    <span>{m.total}</span>
                  </div>
                </div>
              )}
              {m.fields.map((f) => (
                <div
                  key={f}
                  className="min-h-7 rounded-lg border border-gray-200 px-2 py-1 flex items-center text-[10px] text-gray-400"
                >
                  {f}
                </div>
              ))}
              <div className="h-8 rounded-lg bg-black text-white text-[11px] font-medium flex items-center justify-center">
                Submit Payment Proof
              </div>
            </div>
          </div>

          {/* Creator's dashboard */}
          <div aria-hidden="true" className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
              <p className="text-sm font-bold">{m.tableTitle}</p>
              <p className="text-[11px] text-gray-500">{m.meta}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[480px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    {m.cols.map((c) => (
                      <th key={c} className="p-3 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {m.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cellValue, j) =>
                        m.cols[j] === 'Status' ? (
                          <td key={j} className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${
                                cellValue === 'verified'
                                  ? 'bg-green-50 text-green-700'
                                  : cellValue === 'flagged'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {cellValue}
                            </span>
                          </td>
                        ) : (
                          <td key={j} className={`p-3 ${j === 0 ? 'font-medium' : 'text-gray-600'}`}>
                            {cellValue}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100">{m.note}</p>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="w-full px-6 sm:px-10 py-14 border-t border-gray-100">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Why you can trust it with your collections</h2>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {TRUST.map((t) => (
            <div key={t.title} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
              <h3 className="font-semibold text-sm">{t.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full px-6 sm:px-10 py-14 border-t border-gray-100">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Questions</h2>
        <div className="mt-8 max-w-3xl divide-y divide-gray-200 border-y border-gray-200">
          {FAQ.map((item) => (
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

      {/* Final call to action */}
      <section className="w-full px-6 sm:px-10 py-16 border-t border-gray-100 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Make this week’s collection the last messy one.</h2>
          <button
            onClick={handleSignIn}
            className="px-6 py-3.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
          >
            Create your first link →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full px-6 sm:px-10 py-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-400 gap-4">
        <p>© {new Date().getFullYear()} ClearPoint. Built for student creators, runners, and campus vendors.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.values(PERSONAS).map((p) => (
            <Link key={p.slug} href={`/for/${p.slug}`} className="hover:underline">
              For {p.navLabel.toLowerCase()}
            </Link>
          ))}
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
        </nav>
        {WHATSAPP && (
          <div className="flex gap-4">
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer" className="hover:underline">
              Support &amp; Help
            </a>
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer" className="hover:underline">
              Advertise with Us
            </a>
          </div>
        )}
      </footer>
    </main>
  )
}
