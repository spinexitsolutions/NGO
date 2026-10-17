# Production deployment

## Option A — Docker (any container host: Render, Railway, Fly.io, ECS, a VPS)
1. The database is a SQLite file in `/app/server/data` — mount a **persistent volume** there (and for uploads).
2. Build and run the image from the repository root:
   ```bash
   docker build -t ngo-platform .
   docker run -p 4000:4000 --env-file server/.env -e NODE_ENV=production -v ngo-data:/app/server/data ngo-platform
   ```
   The container runs `prisma migrate deploy` and then serves the API **and** the built website on port 4000.
3. Run once inside the container: `node dist/scripts/seed.js --no-sample` (roles, settings, pages; drop the flag
   to include labelled sample content for a demo), then `node dist/scripts/createAdmin.js --email you@org --name "You"`.
4. Put it behind HTTPS (the host’s TLS or a reverse proxy) and set `COOKIE_SECURE=true`,
   `PUBLIC_SITE_URL=https://your-domain`.

`docker compose up` starts a production-like container with persistent volumes.

## Option B — Node directly
```bash
npm ci && npm run build          # builds server (dist/) and client (client/dist)
npm run db:deploy                # apply migrations
NODE_ENV=production npm start    # serves API + website
```
Use a process manager (systemd, PM2) and a reverse proxy (Nginx/Caddy) with TLS.

## Production checklist
- [ ] `APP_SECRET` is a fresh 64-hex-char secret; `COOKIE_SECURE=true`; `NODE_ENV=production`
- [ ] `STORAGE_DRIVER=cloudinary` (container disks are ephemeral); private-uploads directory on a persistent volume
- [ ] `EMAIL_TRANSPORT=smtp` with a verified sending domain (SPF, DKIM, DMARC)
- [ ] Razorpay live keys + webhook secret; webhook URL reachable over HTTPS; test a ₹1 live payment and a refund
- [ ] Daily copy of `server/data/ngo.db` off the server + a tested restore
- [ ] Replace all sample content and stock photos; fill in verified registration details only
- [ ] Enable MFA for every staff account; review roles
- [ ] Review the template privacy/terms/refund/safeguarding policies with a qualified adviser
- [ ] Add error monitoring (e.g. Sentry) and uptime checks on `/api/health`
