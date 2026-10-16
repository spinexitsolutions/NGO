# Security & privacy

- **Authentication**: bcrypt (cost 12) passwords with a 10-character minimum; account lockout after 5 failures
  (15 min); identical errors for unknown email vs wrong password; optional TOTP MFA (secrets AES-256-GCM encrypted
  at rest); password reset with single-use, hashed, 1-hour tokens that revoke all sessions.
- **Sessions**: opaque 256-bit token in an `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookie; only its
  SHA-256 is stored; 12 h idle / 7 day absolute expiry; revocable per device; deactivating a user or changing a
  password invalidates sessions immediately; the user’s role is re-read on every request.
- **CSRF**: double-submit token header on every state-changing request.
- **Authorization**: every admin route enforces permissions server-side (`requirePermission`); publishing content
  can require a separate permission; there is no public admin registration; at least one Super Admin must remain.
- **Input**: every request body is validated with Zod; Prisma parameterises queries; CMS markdown is rendered without
  raw HTML and with a URL allow-list (no `javascript:`); links in settings/sections are validated; emails escape
  template variables.
- **Uploads**: type detected from file bytes (not extension/MIME); SVG/HTML/executables rejected; images re-encoded
  (EXIF/GPS stripped); size limits; private CVs stored outside the web root.
- **Payments**: order amounts set on the server; checkout signatures and webhook signatures (HMAC-SHA256, constant-time
  compare) verified; amount mismatch never marks success; idempotent state transitions and unique webhook event ids;
  no card data stored; secrets only in environment variables.
- **Headers & limits**: Helmet (CSP, HSTS, frameguard…), rate limits on the API, login, forms and checkout.
- **Privacy**: public APIs exclude private fields (consent notes, unpublished budgets, unverified counts, internal
  notes); registration and bank details are public only when explicitly enabled; beneficiary records are only
  available to permitted staff and every view is audit-logged; exports are permissioned and logged; donors can export
  their data and staff can erase personal data while keeping anonymised financial records; analytics load only
  after cookie consent.
- **Audit log**: logins, failed logins, publishing, content changes, financial actions, exports, role changes.
