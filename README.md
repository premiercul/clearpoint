# ClearPoint

Next.js 14 (App Router) + Tailwind 3 + Supabase. Collection links for class reps, runners and campus vendors — ClearPoint never holds money.

## Setup

1. **Node**: use Node 20 or 22 LTS (Next 14 + Node 24 can be flaky).
2. **Install** (Windows, from this folder):
   ```
   rmdir /s /q node_modules
   npm ci
   ```
3. **Env**: copy `.env.example` to `.env.local` and fill in your Supabase URL + anon key.
4. **Database**: Supabase Dashboard → SQL Editor → paste and run `supabase/schema.sql` (safe to re-run; it upgrades an existing database). Then make yourself admin:
   ```sql
   update public.profiles set is_admin = true where email = 'you@gmail.com';
   ```
5. **Auth**: Supabase → Authentication → URL Configuration: add `http://localhost:3000/auth/callback` and your production `/auth/callback` URL to Redirect URLs. Google provider must be enabled.
6. `npm run dev`

## What the hardening does

- Profiles are private (emails no longer public); nobody can grant themselves admin.
- Payers never query tables directly: they use `get_public_collection()` and `submit_proof()` (validated, throttled per network).
- Receipts live in a **private** bucket (3 MB cap, JPG/PNG/WebP), opened by the creator through short-lived signed links.
- Super-admin authorisation + stats are computed in the database (`admin_stats()`), not by an email in the browser.
- CSV export neutralises spreadsheet formulas and escapes quotes.

## Known limits / next steps

- No CAPTCHA yet (honeypot + per-network throttle only). Add Cloudflare Turnstile if spam appears.
- Receipts are deleted when the creator deletes them; there is no automatic expiry. Do it with a scheduled Edge Function that calls the Storage API (deleting `storage.objects` rows in SQL leaves the files behind).
- Uploads that never get submitted can leave orphan files; a periodic cleanup can remove them.
- Still on `@supabase/auth-helpers-nextjs` (deprecated). Migrating to `@supabase/ssr` is a separate, testable change.
- Run `npm audit` after install and review before launch.

## Where images are stored

All receipt/image access goes through `lib/storage.ts` (upload, get a short-lived view URL, delete). The database keeps only object paths, never URLs: the bucket is private and signed URLs expire, so a URL is generated whenever a creator opens an image. To switch to Cloudflare R2 later, reimplement those three functions and copy the files across under the same paths; no database change is needed.

## Price models and dashboards

Each link picks how the price is set, and each type of link gets the dashboard view that solves that person's problem:

| Type | Price | Extra dashboard view |
|---|---|---|
| Class rep / lecturer | Fixed amount | Duplicate matric-number warning, verified-only export sorted by department |
| Delivery runner (on campus) | Flat delivery fee + the item cost the payer enters | Run board grouped by drop-off point, items to buy, your fees, tap-to-call, Mark delivered |
| Business / vendor | Price list (items x quantity, optional flat fee) | Pick list with item totals, revenue, orders per pickup point |

The database works out each submission's total itself (`submit_proof`), so a payer can't change what they owe. The creator sees "Expected" next to every receipt to compare with their bank alert. Delivery drop-off points are a dropdown the runner fills in (departments, faculties, lecture halls). Links can also close automatically at a set time.

**Re-run `supabase/schema.sql` before using this version**: it adds the pricing columns, replaces `submit_proof`, and migrates existing links to fixed-amount pricing.

## Admin area (`/super-admin`)

Admin-only (set `profiles.is_admin = true` for yourself in SQL). Every admin action runs through a database function that re-checks the flag.

- **Overview**: creators, live links, submissions, creator-verified volume, open reports, storage used, links by type, submissions per day.
- **Links**: search by title, creator email or account number; Take down (reversible, the creator can't undo it, and they see your note), Restore, Delete (also removes the uploaded images).
- **Creators**: search; Suspend (takes down all their links and blocks new ones) or lift the suspension.
- **Reports**: payers use "Report this link" on the payment page; review, take the link down, dismiss or resolve.
- **Promotions**: upload a sponsored banner (cropped to 16:5 and compressed in the browser), set the link, placement (creator dashboard, landing page or both) and dates. It shows with a "Sponsored" label on the creator dashboard, the landing page and/or the payer confirmation screen (the screen after a payer submits), never on the payment form. Creators can opt their links out ("Payer ads" switch). Views and clicks are counted. Several live banners for one place rotate randomly.

Admins can't open payers' receipts; they stay private to the link's creator.

`/privacy` is a plain-language privacy page (linked from the landing and payment pages). Have it reviewed before launch.

## Keeping the free Supabase project awake

Supabase pauses free projects that see little database activity for a week. Real traffic counts, but quiet weeks (holidays, exams) can pause the app, and a ping can't wake a project that is already paused (restore it from the dashboard, within 90 days). Three ways in, use at least one:

1. **GitHub Actions** (most reliable, talks to Supabase directly, every 6 hours): the workflow is in `.github/workflows/keepalive.yml`. Add repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then run it once from the Actions tab (Run workflow) to confirm it says OK. GitHub switches scheduled workflows off after 60 days without repository activity, so re-enable it if that happens.
2. **Vercel Cron** (once a day): `vercel.json` already schedules `/api/keepalive`. Optionally set `CRON_SECRET` in your Vercel environment variables to protect the endpoint.
3. **Any external pinger** (cron-job.org, UptimeRobot): point it at `https://YOUR-SITE/api/keepalive` every few hours (send `Authorization: Bearer <CRON_SECRET>` if you set one).

The admin Overview shows when the last ping arrived and turns red if it is more than two days old. Upgrading to Pro removes the pause entirely.

## One form per account type

The account type chosen at sign-up decides everything on the create-link form and the dashboards: the wording (collection / delivery run / order link), the price setup (reps: one fixed amount, delivery: flat fee + item cost, vendors: price list) and the starting fields. There is no type or price-model picker on the form. Reps can switch to a price list for several items with one small link. A creator can change their account type from the dashboard (top bar) or the "change" link on the create page; existing links keep their own type.

## Search (SEO) and AI visibility

- Set `NEXT_PUBLIC_SITE_URL` to your real address before deploying (canonical links, sitemap and share previews use it).
- Public pages: `/` and one page per audience (`/for/class-reps`, `/for/delivery-runners`, `/for/campus-vendors`, content in `lib/content.ts`). They carry titles, descriptions, canonical links, a share-preview image (`app/opengraph-image.tsx`) and structured data (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList).
- `/robots.txt` (`app/robots.ts`) and `/sitemap.xml` (`app/sitemap.ts`) are generated. Payer links (`/pay/...`), the dashboard, onboarding and admin are disallowed and marked noindex.
- `/llms.txt` gives AI assistants a plain-text summary of what ClearPoint is and is not. AI search bots are allowed on the public pages only (edit the list in `app/robots.ts` to opt out of training bots).
- After deploying: submit `https://YOUR-SITE/sitemap.xml` in Google Search Console and Bing Webmaster Tools, and test a link preview by sharing the home page in WhatsApp.
- Keep every claim in `lib/content.ts` true to the product; it is read by people and by AI answer engines.

## Working on this project with an AI assistant

`AGENTS.md` (and `CLAUDE.md`, which points to it) describes the architecture, the security rules that must not be broken and the commands, so coding assistants start with the right context.

## Deploying (GitHub + Vercel)

1. Put the project on GitHub (private repository). `.gitignore` keeps `.env.local` and `node_modules` out.
2. Import the repository in Vercel and add the environment variables from `.env.example` (all environments), then deploy.
3. Set `NEXT_PUBLIC_SITE_URL` to the live address and redeploy. In Supabase (Authentication, URL Configuration) set the Site URL and add `https://YOUR-SITE/auth/callback` to Redirect URLs; add the site to the Authorized JavaScript origins of your Google OAuth client.
4. For the keep-alive ping add the GitHub secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or delete `.github/workflows/keepalive.yml`), and optionally set `CRON_SECRET` in Vercel.
5. Vercel's free Hobby plan is limited to non-commercial use; sponsored banners make the site commercial, so plan for the Pro plan (or another host) when you start running ads.

## Favicon and installable app

- Tab icon: `app/icon.tsx`. iPhone home-screen icon: `app/apple-icon.tsx`. App icons for the manifest: `/pwa-icon/192`, `/pwa-icon/512` and `/pwa-icon/maskable` (all drawn from `lib/brandIcon.tsx`, so one change restyles every icon).
- `app/manifest.ts` makes ClearPoint installable. It opens on `/dashboard` and has a "Create a link" shortcut. Creators see an "Install app" button in the dashboard bar (Chrome/Edge give a one-tap install; on iPhone it shows the Share, then Add to Home Screen steps).
- `public/sw.js` only serves `public/offline.html` when a page can't load offline. It deliberately caches nothing else. It registers in production only.
- After deploying, open `/icon`, `/apple-icon`, `/pwa-icon/192`, `/pwa-icon/512`, `/pwa-icon/maskable` and `/manifest.webmanifest` to check each one loads, then run Lighthouse (Chrome DevTools) to confirm the app is installable.
