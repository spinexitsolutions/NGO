# API reference

Base URL `/api/v1`. JSON in and out: success `{ "data": …, "meta"?: … }`, error
`{ "error": { "code", "message", "details"? } }` (`details` = `[{ path, message }]` for 422 validation errors).

**Auth**: httpOnly session cookie set by `POST /auth/login`. **CSRF**: every non-GET request must send the
`ngo_csrf` cookie value in the `X-CSRF-Token` header (the cookie is issued on any GET). Webhooks are exempt
(signature verified instead). **Money** is integer minor units (paise). Lists accept `?page&limit` (≤100);
many admin lists accept `?format=csv`.

## Public
| Method & path | Description |
| --- | --- |
| GET `/public/site` | Published theme, settings (registration/bank details only when verified/enabled), navigation, content version |
| GET `/public/site/version` | Content version (clients poll to refresh after publishing) |
| GET `/public/pages/:slug` | Published page `{ title, seo, sections[] }` |
| GET `/public/campaigns?phase=active\|upcoming\|completed\|all&featured&cause&q&limit` | Campaigns with `raised`, `donors`, `percent` (verified donations only) |
| GET `/public/campaigns/:slug` | Campaign + updates, related projects, recent supporters (first names; anonymous respected) |
| GET `/public/causes/:slug`, `/public/projects/:slug`, `/public/events/:slug` | Detail with related content; event spots left |
| GET `/public/posts?page&category&tag&q`, `/public/posts/:slug` | Blog list (with categories) and article (+ related) |
| GET `/public/c/:key?…` , `/public/c/:key/:slug` | Generic published collections: causes, projects, stories, testimonials, team, partners, impactStats, faqs, documents, galleryAlbums, opportunities, jobs, events |
| GET `/public/search?q=` | Global search |
| GET `/public/impact-summary` | Aggregates only |
| GET `/sitemap.xml`, `/robots.txt` | SEO |

## Forms (rate-limited, honeypot-protected)
| POST `/forms/inquiries` | Contact / partnership / CSR / membership / fundraising / sponsorship / donation-support inquiry |
| --- | --- |
| POST `/forms/newsletter`, `/forms/newsletter/unsubscribe` | Subscribe (consent required) / unsubscribe by token |
| POST `/forms/volunteer-applications` | Multipart: `data` (JSON) + optional `resume` (PDF ≤ 5 MB) |
| POST `/forms/volunteer-applications/status` | `{ reference, email }` |
| POST `/forms/events/:slug/register`, `/forms/events/registrations/cancel` | Register (confirmed or waitlisted) / cancel with emailed token |

## Donations
| POST `/donations/checkout` | Validates amount/campaign server-side, creates donor + pending donation + provider order/subscription. Returns public checkout params only |
| --- | --- |
| POST `/donations/verify` | `{ reference, paymentId, signature, orderId?, subscriptionId? }` — signature verified before success |
| POST `/donations/failed` | Marks a PENDING donation failed (never downgrades a success) |
| GET `/donations/:reference/status` | Minimal status for the thank-you page |
| POST `/donations/sandbox/authorize` | Sandbox only, disabled in production |
| POST `/webhooks/razorpay` | Raw body, `X-Razorpay-Signature` verified, idempotent by `X-Razorpay-Event-Id` |
| POST `/donor/login`, `/donor/session`, `/donor/logout`; GET `/donor/me`, `/donor/receipts/:id/pdf`, `/donor/export`; PUT `/donor/preferences`; POST `/donor/recurring/:id/cancel` | Donor portal (magic link) |

## Auth
`POST /auth/login`, `/auth/mfa/verify`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`,
`/auth/change-password`, `/auth/mfa/setup|enable|disable`; `GET /auth/me`, `/auth/sessions`; `DELETE /auth/sessions/:id`.

## Admin (permission in brackets — enforced server-side)
| Area | Endpoints |
| --- | --- |
| Theme/settings/navigation [website.theme] | GET `/admin/config/:key`; PUT `/:key/draft`; POST `/:key/publish`, `/:key/discard`, `/:key/reset {group?}`; GET `/:key/versions`; POST `/:key/versions/:id/restore`; GET `/admin/config/presets/themes` |
| Pages [website.pages] | GET/POST `/admin/pages`; GET `/:id`; PUT `/:id/draft`, `/:id/settings`; POST `/:id/publish`, `/:id/schedule`, `/:id/unpublish`, `/:id/duplicate`, `/:id/versions/:vid/restore`; GET `/:id/versions`; DELETE `/:id {confirm:true}`; `/admin/section-templates` |
| Collections [per collection] | GET `/admin/collections/:key` (search, status, CSV), `/:key/options`, `/:key/:id`; POST `/:key`, `/:key/:id/duplicate`; PUT `/:key/:id`; DELETE `/:key/:id {confirm:true}`. Publishing may additionally need content.publish |
| Media | GET `/admin/media`, `/:id/usage`; POST `/admin/media` (multipart `files`), `/:id/replace`; PUT `/:id`; DELETE `/:id {confirm, force?}` |
| Donations [donations.view/manage/export] | GET `/admin/donations` (filters, CSV), `/:id`, `/recurring/list`, `/receipts/:id/pdf`; POST `/offline`, `/:id/refund`, `/:id/receipt`, `/receipts/:id/email`, `/receipts/:id/void`, `/recurring/:id/cancel`; `/admin/donors` list/detail/preferences/anonymise |
| Volunteers [volunteers.view/manage] | `/admin/volunteers/applications` (+ `/:id`, `/:id/status`), `/profiles` (+ `/:id`, `/:id/resume`), `/assignments`, `/hours` |
| Events [events.manage] | `/admin/events/:id/registrations` (GET, POST walk-in, CSV), PUT `/registrations/:id`, POST `/:id/cancel` |
| Beneficiaries [beneficiaries.view/manage] | `/admin/beneficiaries` CRUD, `/summary`, `/:id/assistance`, `/:id/notes` (views are audit-logged) |
| Inquiries & subscribers [inquiries.manage] | `/admin/inquiries`, `/admin/subscribers`, `/admin/notes` |
| Email [email.templates] | `/admin/email/templates` (+ PUT, reset, preview, test), `/log`, `/announce-campaign-update` |
| Staff [users.manage] | `/admin/users` (+ reset-password, revoke-sessions, disable-mfa), `/admin/roles` |
| Dashboard / reports / audit | `/admin/dashboard/overview`, `/admin/reports/:type` (donations-monthly, campaigns, volunteers, events, projects, assistance; CSV), `/admin/audit`, `/admin/notifications` |
