# ClearPoint: guide for AI coding assistants

ClearPoint is a Next.js 14 (App Router) + Tailwind 3 + Supabase web app for Nigerian campuses. A creator (class rep, delivery runner or vendor) signs in with Google, publishes a payment link, and payers (no account) transfer money directly to the creator's bank account, fill a form and upload a receipt. ClearPoint never holds money and cannot confirm a transfer arrived: the creator checks their own bank alert and marks each submission verified or flagged.

## Commands
- Install: `npm ci` (Node 20 or 22 LTS). Lint: `npm run lint`. Build: `npx next build`. Dev: `npm run dev`.
- The owner develops on Windows (PowerShell). Zips are merged with `robocopy ... /MIR /XD .git node_modules .next .vercel /XF .env.local tsconfig.tsbuildinfo`, so never rely on files that only exist locally (`.env.local` is excluded and must keep working).
- There are no automated tests yet. After changes run lint + build and the manual checklist at the bottom.

## Map
- `app/page.tsx` server component (metadata + JSON-LD) rendering `components/Landing.tsx`.
- `app/for/[slug]` audience pages; their text lives in `lib/content.ts` (also feeds `llms.txt`, FAQ markup).
- `app/pay/[id]` public payer page (client component, noindex). `app/dashboard` creator area (`create`, `[id]` submissions with role views). `app/onboarding` choose/change account type. `app/super-admin` admin tabs (`components/admin/*`). `app/auth/callback` OAuth. `app/api/keepalive` keeps the free Supabase project awake.
- `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/icon.tsx`, `app/llms.txt/route.ts` SEO / AI discovery. `lib/site.ts` holds the site URL (`NEXT_PUBLIC_SITE_URL`).
- `lib/templates.ts` per account type: starting fields, price setup and ALL wording (`copy`). `lib/pricing.ts` totals, `lib/storage.ts` the only file that touches image storage, `lib/exportUtils.ts` CSV.
- `supabase/schema.sql` the whole database (idempotent, re-runnable). `middleware.ts` keeps signed-out users out of `/dashboard`, `/onboarding`, `/super-admin`.

## Account types and links
`profiles.account_type` is `academic` (class rep / lecturer: fixed amount), `delivery` (on-campus runner: flat fee + item cost the payer enters) or `vendor_social` (one product per link with name, price, description and a quantity picker). The type decides the create form, wording and dashboard view. There are no type or price-model pickers on the form. Reps may switch to a multi-item price list; vendors never get "add item".

## Rules that must not be broken
1. Payers never read or write tables. They only call the RPCs `get_public_collection`, `submit_proof`, `report_link`, `get_promotion`, `track_promotion_click` (and `keepalive`). Everything else is row-level security for the creator.
2. The total a payer owes is computed in `submit_proof` (SQL). Client totals (`computeTotal`) are display only. Never trust a total from the browser.
3. Receipts and uploaded images live in the private `receipts` bucket. The database stores object paths, never URLs; signed URLs are created on demand in `lib/storage.ts`. Admins cannot open receipts. The `promotions` bucket is public and admin-write only.
4. Creators cannot write `admin_disabled`, `admin_note`, `suspended` or `is_admin` (column grants). Every `admin_*` function re-checks `is_admin()` itself. Admin pages are not security; the database is.
5. Sponsored banners appear only on the creator dashboard, the landing page and the payer's post-submit screen, never on the payment form, and links can opt out (`show_sponsored`).
6. Any database change goes into `supabase/schema.sql` (idempotent) and the owner re-runs the whole file. Keep `privacy` page text and `lib/content.ts` true to what the code does.
7. The service worker (`public/sw.js`) only shows `public/offline.html` when a page can't load offline. It must never cache pages, payments, receipts, API or Supabase responses. Icons come from `lib/brandIcon.tsx`; the manifest is `app/manifest.ts`.
8. Internal links use `next/link`; no nested `<form>`; no `any`; Tailwind v3 classes only; images shrunk in the browser before upload (`lib/image.ts`).

## Environment variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, optional `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_CONTACT_EMAIL`, `CRON_SECRET`.

## Manual checklist
Run `schema.sql`; sign in with Google; pick a type; create one link of each type; open each in a private window and submit with a receipt; confirm "Expected" totals, run board / pick list, CSV export, report button, delete a link (images removed); make yourself admin and open `/super-admin`.

## Known gaps
No editing a link after publishing; no "adjust total" for delivery; flat delivery fee only; no automatic data expiry; no CAPTCHA (honeypot + per-network throttle only); still on `@supabase/auth-helpers-nextjs` (deprecated); run `npm audit` before launch.
