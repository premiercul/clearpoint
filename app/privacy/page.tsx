// app/privacy/page.tsx
import Link from 'next/link'

export const metadata = { title: 'Privacy', alternates: { canonical: '/privacy' } }

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || ''
const WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '').replace(/\D/g, '')

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6 text-sm leading-relaxed text-gray-700">
        <Link href="/" className="text-xs text-gray-500 hover:underline">
          ← ClearPoint
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-black">Privacy</h1>
        <p className="text-xs text-gray-400">Last updated: October 2026</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-black">What ClearPoint is</h2>
          <p>
            ClearPoint helps class reps, delivery runners and campus vendors collect details and proof of payment in one
            place. ClearPoint never holds, receives or moves money. Payers transfer directly to the account the link
            creator enters.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-black">What we collect</h2>
          <p>
            <span className="font-medium text-black">Link creators</span> sign in with Google. We receive your name and
            email address, and we store the links you create, including the bank details you enter on them.
          </p>
          <p>
            <span className="font-medium text-black">Payers</span> do not need an account. When you use a link, we store
            what you type into the form (for example your name, phone number, matric number, drop-off point or order),
            the items and total you chose, and any images you upload (for example a payment receipt screenshot). Images
            are shrunk on your phone before they upload.
          </p>
          <p>
            To limit spam, we also store a scrambled (hashed) identifier derived from your network address. It cannot be
            used to read your address back.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-black">Who can see it</h2>
          <p>
            What a payer submits is visible to the creator of that link. Uploaded images are private and can only be
            opened by that creator. ClearPoint administrators can see a link&apos;s set-up (title, bank details and
            activity counts) to deal with reports of scams or abuse, but they cannot open payers&apos; uploaded
            receipts.
          </p>
          <p>We do not sell your data.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-black">Where it is stored and for how long</h2>
          <p>
            Data is stored with our hosting provider, Supabase. Submissions and images are kept until the creator deletes
            them (creators can delete submissions, or a whole link, at any time). There is no automatic expiry yet.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-black">Sponsored banners</h2>
          <p>
            ClearPoint may show a small, clearly labelled &quot;Sponsored&quot; banner chosen by us. Payers only see one on
            the confirmation screen after they have submitted, never on the payment form. Link creators can switch this
            off for their links. Clicking a banner takes you to another website, which has its own privacy practices. We
            count how many times a banner is shown and clicked, but we do not pass your details to sponsors.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-black">Reporting a link</h2>
          <p>
            Every payment page has a &quot;Report this link&quot; button. If a link looks like a scam or has wrong account
            details, tell us and we will review it and can take it down.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-black">Your choices</h2>
          <p>
            To ask for your data to be corrected or deleted, contact the creator of the link you used, or contact us:
            {CONTACT_EMAIL ? (
              <>
                {' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            ) : WHATSAPP ? (
              <>
                {' '}
                <a href={`https://wa.me/${WHATSAPP}`} className="underline" target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                .
              </>
            ) : (
              ' use the contact details where you found ClearPoint.'
            )}
          </p>
        </section>
      </div>
    </main>
  )
}
