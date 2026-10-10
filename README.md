# DiagnoCare

Clinic website and secure patient and staff portal for **Meghnad Diagnostic Centre (MDC)**, Bhosari, Pune (Dr. Meghnad Padsalgikar, MBBS, DMRE, DNB (Radiology)). Built as the CS3111 Web Technologies course project.

## Overview

A public portfolio site (services, doctor, branches, reviews, FAQ, contact) plus a role-based portal for online booking with a pre-scan safety checklist, encrypted report delivery, a priority reading queue and a critical finding alert that escalates until someone acknowledges it.

## Features by role

| Role | What they can do |
|---|---|
| Public visitor | Browse services (filter USG, CT, Biopsy), doctor profile, branches with maps, approved reviews, FAQ, contact, privacy and terms |
| Patient | Register and verify email, book, reschedule and cancel (capacity enforced with row locking, other-branch suggestion when full), complete the pre-scan checklist, get an `.ics` file and Google Calendar link, download own released reports, acknowledge critical alerts, review a completed visit |
| Receptionist | Appointment list and status changes, upload reports, link referrals, alert board with red-flag escalations, record phone contact and resolve alerts |
| Doctor | Priority reading queue (Routine, Priority, Urgent with waiting time), upload reports with encrypted notes, flag a report Critical |
| Referrer | Create referrals, track status, download the report for their own referred patients, acknowledge critical alerts |
| Admin | CRUD for users, branches, scan types and categories, checklist items, slots and capacity, site settings, FAQs, doctor profile, review moderation; audit log viewer; stats |

## Tech stack

- Frontend: React 18, TypeScript, Vite, Redux Toolkit, React Router 6, Vitest and Testing Library
- API: plain PHP 8.3 MVC (own Router, middleware pipeline and container), PDO, PHPUnit
- Worker: Node.js 24, Express 5, `pg`, nodemailer
- Data: Supabase PostgreSQL (Row Level Security locked down) and a private Storage bucket
- Delivery: Docker, Render (API and worker), Vercel or Cloudflare Pages (frontend)

## Structure

```
frontend/          React app (public site and portal)
backend/           PHP REST API (Core, Controllers, Models, Middleware, Services, Validation)
services/alerts/   Node worker: escalation, reminders, status page, rotating audit log
database/          SQL migrations and seeds
docs/              Architecture, API, security, syllabus mapping, conventions, test report
postman/           Postman collection
render.yaml        Render blueprint for the API and the worker
docker-compose.yml Local containers
```

## Documentation

- `docs/ARCHITECTURE.md` diagrams, request lifecycle, data model, alert flow
- `docs/DEPLOYMENT.md` production setup on Vercel, Render and GitHub Actions
- `docs/API.md` every endpoint with roles and HTTP method rationale
- `docs/SECURITY.md` each control and the file that implements it
- `docs/SYLLABUS_MAPPING.md` syllabus and checklist items mapped to files
- `docs/TEST_REPORT.md` test cases with real results
- `docs/CONVENTIONS.md` coding conventions and the schema notes
- `DECISIONS.md` design decisions, `PROGRESS.md` phase log, `MANUAL_STEPS.md` items that need a human

## Prerequisites

- PHP 8.3 with `pdo_pgsql`, `openssl`, `mbstring`, `fileinfo`, `curl`
- Composer 2
- Node.js 20 or newer (24 used in development) and npm
- A Supabase project (Postgres and Storage), or the optional local Postgres from Docker
- Docker Desktop (optional)

## Configure

```bash
cp .env.example .env
```

Fill in `.env` (database, Supabase, SMTP if you want real email). Generate the three secrets, one distinct value each for `APP_KEY`, `ENCRYPTION_KEY` and `CSRF_SECRET`:

```bash
php -r "echo 'base64:' . base64_encode(random_bytes(32)), PHP_EOL;"
```

Also set `ALERTS_SERVICE_TOKEN` to a long random string (for example `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`).

## Install, migrate, seed

```bash
npm run setup          # npm install (root, frontend, alerts) and composer install
npm run migrate        # apply database/migrations in order (npm run migrate:status to inspect)
npm run seed           # production-safe base data: branches, 56 scans, checklists, FAQs, settings
npm run seed:dev       # development only: one user per role and two weeks of slots
npm run seed:demo      # development only: reviews labelled "Demo data"
npm run storage:setup  # create the private reports bucket if missing
npm run db:counts      # row count per table
```

`seed:dev` and `seed:demo` refuse to run when `APP_ENV=production`. Remove demo reviews with `npm run seed:purge-demo`.

## Run locally

### Option 1: Docker Compose

```bash
docker compose up --build
```

- API: http://localhost:8000/api/v1/health
- Frontend: http://localhost:5173
- Alerts status page: http://localhost:4000

For a local database instead of Supabase: `docker compose --profile localdb up --build`, then point `DB_HOST=localhost`, `DB_PORT=54322`, `DB_USER=diagnocare`, `DB_PASSWORD=diagnocare_local_only`, `DB_NAME=diagnocare` and `DB_SSLMODE=disable` in `.env`, and run the migrate and seed commands above.

### Option 2: without Docker

```bash
npm run dev            # API on 8000, Vite on 5173, alerts on 4000 together
```

or in separate terminals:

```bash
php -S localhost:8000 -t backend/public     # API
npm run dev --prefix frontend               # React app, Vite proxies /api to port 8000
npm run dev --prefix services/alerts        # worker
```

Open the app through http://localhost:5173 so the session cookie is same-origin. With `MAIL_DRIVER=log`, verification and reset emails (including links) are written to `backend/storage/logs/mail.log`; set `MAIL_DRIVER=smtp` and the `SMTP_*` values to send real mail.

Quick API check:

```bash
curl -c jar -b jar http://localhost:8000/api/v1/auth/csrf          # copy data.csrf_token
curl -c jar -b jar -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'X-CSRF-Token: <token>' \
  -d '{"email":"patient@diagnocare.test","password":"Patient@Dev2026!","remember":true}'
curl -b jar http://localhost:8000/api/v1/auth/me
```

### Development logins (development database only)

These exist only after `npm run seed:dev`. Never create them in production.

| Role | Email | Password |
|---|---|---|
| admin | admin@diagnocare.test | Admin@Dev2026! |
| doctor | doctor@diagnocare.test | Doctor@Dev2026! |
| receptionist | reception@diagnocare.test | Reception@Dev2026! |
| patient | patient@diagnocare.test | Patient@Dev2026! |
| referrer | referrer@diagnocare.test | Referrer@Dev2026! |

## Test

```bash
npm test               # PHPUnit and Vitest
npm run test:api       # PHPUnit only
npm run test:web       # Vitest only
npm test --prefix services/alerts   # Node tests (node --test)
npm run build          # type-check and production build of the frontend
```

Results and use cases are in `docs/TEST_REPORT.md`; the Postman collection is in `postman/`.

## Deploy

The live production setup (same-origin Vercel rewrite, Render free plan, scheduled jobs, SMTP switch) is described in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The sections below are the generic guide.

Production layout: frontend on Vercel or Cloudflare Pages, API and alerts worker on Render (Docker), database and bucket on Supabase.

### 1. Supabase

1. Create a project and note the connection details, `SUPABASE_URL` and the service key.
2. Run the migrations and the base seed against it from your machine with production values in `.env`: `npm run migrate`, `npm run seed`, `npm run storage:setup`. Do not run `seed:dev` or `seed:demo`.
3. Create the first admin account. Generate a hash with `php -r "echo password_hash('CHOOSE-A-STRONG-PASSWORD', PASSWORD_ARGON2ID), PHP_EOL;"`, then run in the Supabase SQL editor:

```sql
INSERT INTO users (email, password_hash, role, full_name, email_verified_at, password_changed_at)
VALUES ('admin@your-domain.example', '<hash>', 'admin', 'Clinic Admin', now(), now());
```

   Sign in and change the password from the account page; create staff users from the admin panel.

### 2. Render (API and worker)

`render.yaml` defines two Docker web services, `diagnocare-api` (`backend/Dockerfile`, health check `/api/v1/health`) and `diagnocare-alerts` (`services/alerts/Dockerfile`, health check `/health`).

1. In Render choose New, Blueprint, and select this repository.
2. Enter every variable marked `sync: false`: `APP_URL` (the API's public https URL), `FRONTEND_URL` (the frontend's https URL), `CORS_ALLOWED_ORIGINS` (the same frontend origin, no trailing slash, comma-separated if several), `APP_KEY`, `ENCRYPTION_KEY`, `CSRF_SECRET`, database values, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SMTP_*`, `MAIL_FROM`, and for the worker `ALERTS_SERVICE_TOKEN`. Give both services the same database values; the worker does not need the encryption keys or Supabase keys.
3. The API image listens on `$PORT` (8080 by default), runs Apache as the non-root `www-data` user with opcache enabled, serves only `backend/public`, and keeps `storage/` outside the web root.
4. Set `ALERT_ESCALATION_MINUTES` identically on both services.

The container filesystem is ephemeral: PHP file sessions are lost on restart or redeploy (remember-me restores them) and `backend/storage/uploads` (doctor photo) is not persistent. Attach a persistent disk to the API service mounted at `/var/www/backend/storage` if you need either to survive, and run a single API instance (see `DECISIONS.md`, sessions).

### 3. Frontend

Set the build variable `VITE_API_BASE_URL` to the API URL plus `/api/v1` (for example `https://diagnocare-api.onrender.com/api/v1`) and `SITE_URL` to the live domain.

- Vercel: import the repo, set the root directory to `frontend`. `frontend/vercel.json` provides the SPA rewrite and security headers.
- Cloudflare Pages: root directory `frontend`, build command `npm run build`, output `dist`. `frontend/public/_redirects` and `_headers` are copied into `dist`.

Replace `https://diagnocare-api.onrender.com` in the `connect-src` of `frontend/vercel.json` and `frontend/public/_headers` with your real API origin, or the browser will block API calls.

### Production cookie and CORS notes

- The frontend and API run on different sites, so the session cookie must be `SameSite=None; Secure`. This only works over HTTPS on both sides, which Vercel, Cloudflare Pages and Render provide. `render.yaml` sets `SESSION_SAMESITE=None` and `SESSION_SECURE=true`.
- Safari and some browser privacy modes block third-party cookies even with `SameSite=None`. The robust fix is to serve both from one registrable domain (for example `www.example.com` and `api.example.com`), set `SESSION_DOMAIN=.example.com` and keep `SameSite=None; Secure`, or place the API behind the same origin as the frontend through a rewrite.
- `CORS_ALLOWED_ORIGINS` must list the exact frontend origin(s). Wildcards are never used because cookies are sent (`Access-Control-Allow-Credentials: true`).
- `TRUST_PROXY=true` makes the API read the client IP from `X-Forwarded-For`, which rate limiting and the audit log use; leave it `false` when not behind a trusted proxy.
- Keep `APP_ENV=production` and `APP_DEBUG=false` so errors are generic and HSTS is sent.

## Encryption keys and rotation

Report files, report notes and impressions, and referral notes are encrypted with AES-256-GCM (`App\Services\EncryptionService`, `backend/src/Services/EncryptionService.php`). Each value gets a fresh 12 byte IV. Files store the IV, tag and `key_version` in the `reports` row; text columns hold a self-describing envelope `dc:v<version>:<iv>:<tag>:<ciphertext>`.

Storage is chosen by `STORAGE_DRIVER`: `supabase` uses the private bucket `STORAGE_BUCKET` with the service key, `local` writes to `backend/storage/reports` (outside the web root, ignored by version control).

Generate a key:

```bash
php -r "echo 'base64:' . base64_encode(random_bytes(32)), PHP_EOL;"
```

To rotate:

1. Generate a new key.
2. Move the old key into `ENCRYPTION_KEYS_PREVIOUS` with its version, for example `ENCRYPTION_KEYS_PREVIOUS=1=base64:OLDKEY`, set `ENCRYPTION_KEY` to the new key and raise `ENCRYPTION_KEY_VERSION` (to `2`). New data uses the new key at once; old data stays readable.
3. Preview with `php backend/bin/rotate-encryption.php`, then run `php backend/bin/rotate-encryption.php --apply` to re-encrypt existing files and text.
4. When nothing is left to rotate, remove the old key from `ENCRYPTION_KEYS_PREVIOUS`.

`CSRF_SECRET` can be rotated by replacing the value and redeploying; the browser fetches a fresh CSRF token automatically on the next rejected request. Losing every copy of an encryption key makes the data it protects unrecoverable, so keep keys in the hosting secret store and never commit them.

## Credits

See `CREDITS.md`.
