# NGO Platform — website, CMS and management system

A production-oriented platform for nonprofits: a premium public website plus an admin panel to run
donations, campaigns, projects, volunteers, events, beneficiaries, reports and **the entire website
design and content** — without editing code or redeploying.

> **Demo content.** The seed script adds clearly labelled *sample* causes, campaigns, projects, stories,
> team profiles, events and statistics (each shows a “Sample” badge on the site). **No donations,
> partners or testimonials are ever seeded** — those must come from real records. Replace or delete
> sample content before launch.

---

## 1. Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS, Framer Motion, React Query, React Hook Form + Zod, Recharts, dnd-kit | Fast SPA with code splitting; CSS-variable theming lets the admin restyle everything at runtime |
| Backend | Node.js + Express + TypeScript | Simple, well-understood, easy to host anywhere |
| Database | **MongoDB** + Prisma ORM (`server/prisma/schema.prisma`) | Works locally with nothing to install (`npm run local` starts a private MongoDB) and in the cloud with MongoDB Atlas; unique indexes for idempotency, multi-document transactions |
| Auth | Server-side sessions (opaque httpOnly cookie, hashed in DB) + double-submit CSRF + optional TOTP MFA | Revocable sessions, no tokens in JS, works for a same-origin SPA |
| Payments | Razorpay (orders, subscriptions, refunds, webhooks) behind a provider interface; a local **sandbox** provider for development | Real signature verification path in both modes |
| Media | Local disk (dev) or Cloudinary (prod); images re-encoded to WebP with responsive variants by `sharp` | Safe uploads (content sniffing, metadata stripped) and fast delivery |
| Email | SMTP via Nodemailer (works with Resend, SendGrid, SES, Postmark…) or log-only in development | Provider-agnostic; templates editable in admin |
| PDFs | PDFKit | Server-side donation receipts |

**One schema, two sides.** `shared/` defines the theme tokens, site settings, navigation, page-section
types and content collections with Zod. The server validates with them; the admin builds its forms
from the same definitions; the public site renders with them. Adding a section type or a content field
is a change in one file.

**Draft → preview → publish.** Theme, settings, navigation and every page keep a *draft* and a *published*
copy. Editors change drafts (autosaved), preview them in a live iframe of the real site, then publish.
Each publish writes an immutable version that can be restored. The public site polls a content-version
counter, so published changes appear for visitors within a minute — no rebuild, no redeploy.

**Money is never typed in.** Amounts are integer minor units (paise). Campaign totals, dashboards and
reports are calculated from `Donation` rows with status `SUCCESS`/`PARTIALLY_REFUNDED` only. A payment is
marked successful only after its signature (checkout) or webhook signature is verified; status changes
are atomic and idempotent; duplicate webhooks are recorded once (`WebhookEvent` unique key).

```
ngo/
├─ shared/                 @ngo/shared — Zod schemas & types used by server AND client
│  └─ src/  permissions.ts (catalog + default roles) · theme.ts (tokens, presets, CSS vars)
│           settings.ts (site settings + navigation) · sections.ts (page-section registry)
│           collections.ts (CMS content types) · fields.ts (field defs → Zod) · forms.ts · money.ts
├─ scripts/local.mjs       `npm run local` — one-command setup & run on a laptop
├─ server/                 Express + Prisma REST API  (/api/v1)
│  ├─ data/                local MongoDB data (created automatically, not committed)
│  ├─ prisma/              schema.prisma (collections and indexes are created on start)
│  ├─ src/config/          env (validated), db, logger
│  ├─ src/middleware/      sessions/RBAC, CSRF, rate limits, uploads (magic-byte sniffing), errors
│  ├─ src/services/        auth, config (draft/publish), pages, collections, media/storage,
│  │                       donations, payments (razorpay/sandbox), receipts (PDF), email, audit, notifications
│  ├─ src/routes/          public, forms, donations/webhooks/donor portal, seo (sitemap/robots), admin/*
│  ├─ src/jobs/            scheduled publishing & cleanup
│  ├─ src/scripts/         seed, create-admin
│  └─ tests/               Vitest + Supertest against a separate throwaway MongoDB
├─ client/                 React SPA
│  └─ src/  app/ (SiteProvider = theme engine, AuthProvider) · components/ui (design system)
│           components/site (layout, images, motion, cards, forms, SEO) · features/sections (renderers)
│           pages/ (public) · admin/ (layout, cms/ builder & customizer, pages/ operations)
└─ docs/                   api.md · admin-guide.md · security.md · deployment.md
```

## 2. Features

**Public website** — cinematic hero slideshow, causes, campaigns with live verified progress, projects
& impact, success stories (consent-gated), events with registration/waitlist, blog with categories,
tags, search and related posts, gallery with lightbox, team & board, reports & transparency, FAQs,
careers, partnership/CSR/membership/fundraising/sponsorship forms, contact with map, global search,
donor portal (magic link: history, receipts, cancel monthly gift, data export), newsletter, cookie
consent (analytics load only after consent), WhatsApp button, dark mode, reduced-motion support,
sitemap.xml, robots.txt, canonical URLs, Open Graph and JSON-LD.

**Donations** — one-time and monthly, preset/custom amounts validated on the server, campaign/cause/event
attribution, UTM tracking, anonymous option, Razorpay checkout or local sandbox, signature + webhook
verification, idempotent processing, failed/pending handling, refunds (partial/full), offline donations
with audit trail, bank/UPI details with QR (optional), numbered PDF receipts (Indian financial-year
series) with email delivery, void & correction with audit trail. Tax-benefit text appears **only** if
the organisation marks its registration verified and enables it.

**Admin** (`/admin`) — dashboard with charts; **theme customizer** (presets, colours with WCAG contrast
checks, fonts, type scale, buttons, cards, radius, spacing, header/footer style, motion, colour mode)
with live preview; site settings; navigation editor; **page builder** (drag-and-drop sections, show/hide,
duplicate, reset to defaults, reusable section templates, SEO, preview draft, schedule, publish, version
restore); content collections; media library (folders, alt text, replace with automatic reference
update, usage tracking, safe delete); donations, donors, monthly giving; volunteers (applications,
review workflow with emails, assignments, hours); events registrations & attendance; beneficiaries
(private, access-logged); inquiries; subscribers; email templates (edit, preview, test, campaign-update
announcements); staff users, configurable roles & permissions; reports with CSV export and print;
audit log; account security (password, MFA, sessions).

## 3. Run it on your laptop (no database to install)

Requirements: **Node.js 20.11+** only (https://nodejs.org). Windows, macOS and Linux all work.

```bash
git clone https://github.com/spinexitsolutions/NGO.git ngo
cd ngo
npm install
npm run local
```

`npm run local` does everything on the first run: creates `server/.env` with a fresh secret, starts a
private MongoDB (the program is downloaded once, ~100 MB, so the first run needs internet and takes a minute;
data is kept in `server/data/mongo`), adds the labelled sample content, creates an admin account and prints
its email and password (also saved in `LOCAL-ADMIN.txt`), then starts the API and the website.

- Website: http://localhost:5173
- Admin panel: http://localhost:5173/admin

Next time just run `npm run local` again (your data stays in `server/data/mongo`). Stop with **Ctrl+C**.
To start over with a clean database, stop the app and delete the `server/data` folder.

To use your own MongoDB instead (MongoDB Atlas free tier, or one you installed), put its URL in
`DATABASE_URL` in `server/.env`; `npm run local` then uses it and does not start its own. It must be a replica
set (Atlas always is; a self-installed server needs `--replSet rs0` and `rs.initiate()` once).

Manual steps, if you prefer: `cp server/.env.example server/.env` (set `APP_SECRET` and `DATABASE_URL`),
`npm run seed` (`-- --no-sample` to skip sample content), `npm run create-admin -- --email you@org --name "You"`,
`npm run dev`.

### Creating admin accounts
There is **no public registration endpoint**. The first Super Admin is created with
`npm run create-admin` (prompts for a password, or set `ADMIN_PASSWORD`). After that, Super Admins add
staff in **Admin → Staff users** and assign roles (Super Admin, NGO Director, Finance Manager, Campaign
Manager, Volunteer Coordinator, Content Editor, Project Manager — or custom roles).

## 4. Configuration (`server/.env`)

See `server/.env.example` for every variable. Key ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MongoDB URL (must be a replica set). Default: the private local MongoDB on `127.0.0.1:27027` that `npm run local` starts |
| `APP_SECRET` | ≥32 random chars (`openssl rand -hex 32`); encrypts MFA secrets, signs donor sessions |
| `PUBLIC_SITE_URL` | Public URL used in emails, receipts and the sitemap |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `PAYMENT_PROVIDER` | `sandbox` (default) or `razorpay` |
| `EMAIL_TRANSPORT` | `log` (prints emails), `smtp`, or `none` |
| `STORAGE_DRIVER` | `local` (dev) or `cloudinary` |

### Payments (Razorpay)
1. Development uses `PAYMENT_PROVIDER=sandbox`: checkout shows a clearly labelled *test mode* dialog to
   simulate success or failure. The sandbox endpoint is disabled when `NODE_ENV=production`.
2. Create a Razorpay account and generate **test** API keys (Dashboard → Settings → API Keys).
3. Set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
4. Add a webhook (Dashboard → Webhooks) to `https://YOUR_DOMAIN/api/v1/webhooks/razorpay` with a secret
   (`RAZORPAY_WEBHOOK_SECRET`) and events: `payment.captured`, `payment.failed`, `order.paid`,
   `refund.processed`, `refund.failed`, `subscription.charged`, `subscription.halted`,
   `subscription.cancelled`, `subscription.completed`.
5. Monthly giving uses Razorpay Subscriptions (enable it on your account) — or switch it off in
   *Admin → Site settings → Donations*.
6. Test thoroughly with test cards, then swap to live keys. Card data never touches this server.

### Email
Set `EMAIL_TRANSPORT=smtp` and the `SMTP_*` variables. Examples: **Resend** `smtp.resend.com:465`,
user `resend`, password = API key; **SendGrid** `smtp.sendgrid.net:587`, user `apikey`. Verify your sending
domain (SPF/DKIM) with the provider. Every email is logged in *Admin → Email templates → Log*. Marketing
emails include an unsubscribe link and `List-Unsubscribe` header.

### Image storage
Development stores files in `server/uploads` (served at `/uploads`). For production set
`STORAGE_DRIVER=cloudinary` with `CLOUDINARY_*` credentials — container disks are ephemeral.
Volunteer CVs are always stored privately on the server (`PRIVATE_UPLOAD_DIR`) and streamed only to
authorised staff; mount that directory on persistent storage.

## 5. Testing

```bash
npm test                        # shared + server (API against a throwaway MongoDB) + client
npm run typecheck
```

Tests start their own throwaway MongoDB (or use `TEST_DATABASE_URL` if set) and refuse to run against a
database whose name does not contain `test`.
The server suite (53 tests) covers login, lockout, MFA, password reset, CSRF, RBAC on every sensitive
area, theme publish/restore/reset, page publish validation, scheduled publishing, donation checkout
validation, sandbox payment, signature rejection, idempotent verification, duplicate webhooks, amount
mismatch, refunds, offline donations, PDF receipts, void/correction, CSV export permissions, dashboard
status separation, donor portal, volunteer workflow, event capacity/waitlist/attendance, media upload
safety and usage tracking, and public-API privacy.

## 6. Deployment

See [docs/deployment.md](docs/deployment.md). In short: build the Docker image (`Dockerfile` serves the
API and the built website from one origin), point `DATABASE_URL` at MongoDB (e.g. Atlas), set the environment variables, run
`npm run create-admin` once, put it behind HTTPS and set `COOKIE_SECURE=true`.

## 7. Backups & maintenance

- **Database**: on MongoDB Atlas turn on its automatic backups. Otherwise use
  `mongodump --uri "$DATABASE_URL" --out backup-$(date +%F)` and keep copies off the machine; restore with
  `mongorestore`. For the local private MongoDB you can also copy `server/data/mongo` while the app is stopped.
- **Media**: Cloudinary keeps originals; enable backups on your Cloudinary plan or sync to object storage.
  Back up the private-uploads volume (volunteer CVs).
- **Updates**: `npm outdated`, update in a branch, run `npm test`, deploy. New collections and indexes from
  schema changes are created automatically when the app starts.
- **Retention**: expired sessions/tokens and abandoned (24 h) pending checkouts are cleaned automatically.
  Use *Admin → Donors → Erase personal data* for erasure requests (financial records are kept, anonymised).

## 8. Honest status & limitations

- Razorpay integration is implemented against the documented API and verified with signed test payloads;
  it has **not** been exercised against live Razorpay servers from this environment — test with your test
  keys before going live.
- Docker image and Cloudinary/SMTP drivers are implemented but were not run in this environment.
- MongoDB must run as a replica set (Prisma uses transactions). MongoDB Atlas always is; `npm run local`
  and `docker compose` set this up for you.
- Multilingual: the architecture and settings support a language switcher, but page content is single
  language; per-locale content would add a `locale` to pages/collections.
- Stock photography (Unsplash) is used for sample content; replace it with your own photographs taken
  with consent. Never present stock photos as evidence of your activities.
- Not included: offline/PWA caching (a manifest is provided), error-monitoring SDK (add Sentry by setting
  it up in `client/src/main.tsx` and `server/src/index.ts`), 3D graphics (not meaningful for this site).
