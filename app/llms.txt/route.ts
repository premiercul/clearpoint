// app/llms.txt/route.ts
// /llms.txt: a short, plain-text summary for AI assistants and answer engines.
import { FAQ, PERSONAS, PERSONA_ORDER } from '@/lib/content'
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    `${SITE_NAME} is a web app for Nigerian campus communities. A link creator (class rep, delivery runner or vendor) signs in with Google, sets a price and the details to collect, and shares one link. Payers open it on their phone with no account, transfer money directly to the creator's bank account, fill in the form and upload a receipt screenshot. The creator checks each receipt against their own bank alert and marks it verified or flagged.`,
    '',
    '## Key facts',
    `- ${SITE_NAME} never receives, holds or moves money. It is not a payment processor or escrow service.`,
    '- It does not confirm that a transfer arrived. The creator does that from their own bank alert.',
    '- Payers do not need an account. Uploaded receipt images are private to the link creator.',
    '- Three kinds of link: a fixed amount (class dues, manuals), a delivery fee plus the item cost (on-campus delivery runs), and one product with a quantity picker (vendors).',
    '- Creators can export submissions as CSV (opens in Excel) or print them to PDF, and can delete submissions at any time.',
    '',
    '## Pages',
    `- [Home](${absoluteUrl('/')}): what it is and how it works`,
    ...PERSONA_ORDER.map((slug) => `- [${PERSONAS[slug].h1}](${absoluteUrl(`/for/${slug}`)}): ${PERSONAS[slug].description}`),
    `- [Privacy](${absoluteUrl('/privacy')}): what is collected and who can see it`,
    '',
    '## Not for indexing',
    '- Payment links (/pay/...), the creator dashboard and the admin area are private and are disallowed in robots.txt.',
    '',
    '## FAQ',
    ...FAQ.flatMap((f) => [`### ${f.q}`, f.a, '']),
  ]
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
