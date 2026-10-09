# DiagnoCare

Clinic website and secure patient and staff portal for **Meghnad Diagnostic Centre (MDC)**, Bhosari, Pune (Dr. Meghnad Padsalgikar, MBBS, DMRE, DNB (Radiology)). Built as the CS3111 Web Technologies course project.

Status: Phase 2 (PHP core, auth, RBAC, React foundation) complete. See `PROGRESS.md`.

## Structure

```
frontend/          React 18 + TypeScript + Vite (public site and portal)
backend/           PHP 8.3 REST API, plain PHP MVC (Core, Controllers, Models, Middleware, Services, Validation)
services/alerts/   Node.js + Express worker (critical alert escalation, reminders, email)
database/          SQL migrations and seeds for Supabase PostgreSQL
docs/              Conventions, architecture, API, security, test report
postman/           Postman collection
```

Conventions for contributors: `docs/CONVENTIONS.md`. Design decisions: `DECISIONS.md`. Items needing a human: `MANUAL_STEPS.md`.

## Requirements

- PHP 8.3 with `pdo_pgsql`, `openssl`, `mbstring`, `fileinfo`, `curl`
- Composer 2
- Node.js 20+ (24 used in development) and npm
- A Supabase project (Postgres + Storage), or Docker for a local Postgres
- Docker Desktop (optional)

## Setup

```bash
cp .env.example .env
```

Fill in `.env`. Generate the three keys with:

```bash
php -r "echo 'base64:' . base64_encode(random_bytes(32)), PHP_EOL;"
```

Use a separate value for each of `APP_KEY`, `ENCRYPTION_KEY` and `CSRF_SECRET`.

Install dependencies, create the schema and load data:

```bash
npm run setup
npm run migrate
npm run seed           # production-safe base data only
npm run seed:dev       # development: one user per role and two weeks of slots
npm run seed:demo      # development: reviews labelled "Demo data"
npm run storage:setup  # creates the private reports bucket if missing
npm run db:counts      # row count per table
```

`seed:dev` and `seed:demo` refuse to run when `APP_ENV=production`.

Development logins are listed in `docs/CONVENTIONS.md`.

## Run locally

Without Docker (three processes):

```bash
npm run dev
```

- API: http://localhost:8000/api/v1/health
- Frontend: http://localhost:5173 (sign in at `/login` with a dev login; each role lands on its own `/portal/...` dashboard)
- Alerts service: http://localhost:4000/health

Or run the two main processes separately:

```bash
php -S localhost:8000 -t backend/public   # API
npm run dev --prefix frontend             # React app; Vite proxies /api to port 8000
```

Open the app through http://localhost:5173 so the session cookie is same-origin. With `MAIL_DRIVER=log`, verification and password reset emails (including their links) are written to `backend/storage/logs/mail.log`; set `MAIL_DRIVER=smtp` and the `SMTP_*` values to send real email. Runtime files (sessions, logs) live in `backend/storage/`, which is git-ignored.

Quick API check with curl:

```bash
curl -c jar -b jar http://localhost:8000/api/v1/auth/csrf          # copy data.csrf_token
curl -c jar -b jar -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'X-CSRF-Token: <token>' \
  -d '{"email":"patient@diagnocare.test","password":"Patient@Dev2026!","remember":true}'
curl -b jar http://localhost:8000/api/v1/auth/me
```

With Docker:

```bash
docker compose up --build
```

An optional local Postgres is available with `docker compose --profile localdb up`; point `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_SSLMODE=disable` at it.

## Test

```bash
npm test             # PHPUnit + Vitest
npm run build        # type-check and build the frontend
```

Individually: `php backend/vendor/bin/phpunit -c backend/phpunit.xml` and `npx vitest run` inside `frontend/`.

## Encryption keys and rotation

Report files, report notes and impressions, and referral notes are encrypted with AES-256-GCM (`App\Services\EncryptionService`). Each value gets a fresh 12 byte IV. Files store the IV, tag and `key_version` in the `reports` row; text columns hold a self-describing envelope `dc:v<version>:<iv>:<tag>:<ciphertext>`.

Storage is chosen by `STORAGE_DRIVER`: `supabase` uses the private bucket `STORAGE_BUCKET` with the service key, `local` writes to `backend/storage/reports` (outside the web root, ignored by version control).

To rotate the key:

1. Generate a new key: `php -r "echo 'base64:' . base64_encode(random_bytes(32)), PHP_EOL;"`.
2. Move the old key into `ENCRYPTION_KEYS_PREVIOUS` with its version, for example `ENCRYPTION_KEYS_PREVIOUS=1=base64:OLDKEY`, set `ENCRYPTION_KEY` to the new key and raise `ENCRYPTION_KEY_VERSION` (to `2`). New data uses the new key immediately; old data stays readable.
3. Preview the work with `php backend/bin/rotate-encryption.php`, then run `php backend/bin/rotate-encryption.php --apply` to re-encrypt existing files and text values under the new key.
4. When the script reports nothing left to rotate, remove the old key from `ENCRYPTION_KEYS_PREVIOUS`.

Losing every copy of a key makes the data it protects unrecoverable. Keep keys in the hosting secret store and never commit them.

## Deploy

Deployment configs are added in Phase 8.
