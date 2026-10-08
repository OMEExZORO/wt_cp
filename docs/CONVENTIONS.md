# DiagnoCare Conventions

Read this before changing anything. It is the contract between phases.

## Hard rules (from the project spec)

- No code comments in any code file (PHP, TS, JS, SQL, CSS, Dockerfiles, YAML). Explanations go in Markdown.
- Never fabricate reviews, ratings, credentials, phone numbers, fees, hours or statistics. Unknown values come from `site_settings` / `branches` and are flagged `is_placeholder = TRUE`.
- No fetal-sex related field, label or feature anywhere.
- Never commit secrets. Only `.env.example` files with placeholder values. Never print secret values in logs or output.
- Do not run `git commit` / `git push` unless the orchestrator asks.

## Layout

```
/frontend                React 18 + TS + Vite
  src/app/               Redux store (store.ts) and typed hooks (hooks.ts)
  src/api/               fetch wrapper (client.ts); one module per resource, e.g. api/bookings.ts
  src/types/             API response types (api.ts holds the envelope types)
  src/features/<name>/   Redux slices and feature components (auth, booking, alerts)
  src/pages/             route-level components, lazy-loaded with React.lazy
  src/components/        shared presentational components
  src/test/setup.ts      Vitest setup (jest-dom matchers)
/backend                 plain PHP 8.3, MVC, no framework
  public/index.php       single front controller (only file in web root besides .htaccess)
  config/bootstrap.php   autoload + Env::load(backend/.env, repo/.env); returns ['backend_root','repo_root']
  config/app.php         app config array
  src/Core/              Env, Database, Response (Router, Request, Session, Kernel go here in Phase 2)
  src/Controllers/       <Name>Controller.php
  src/Models/            <Name>.php table gateways, PDO prepared statements only
  src/Middleware/        <Name>Middleware.php (Auth, Role, Csrf, Cors, RateLimit)
  src/Services/          business logic (BookingService, EncryptionService, StorageService, Mailer)
  src/Validation/        Validator, Sanitizer, rule classes
  src/Exceptions/        AppException base (errorCode, status, fields) and subclasses
  bin/                   CLI scripts: migrate.php, seed.php, storage-setup.php
  tests/Unit/            PHPUnit tests, namespace Tests\Unit
  storage/               runtime files (git-ignored)
/services/alerts         Node 24 + Express (ESM), src/index.js, src/config.js, src/db.js (pg Pool)
/database/migrations     NNN_snake_case.sql, applied in order
/database/seeds          seed_base.sql, seed_dev.php, seed_demo.sql
/docs                    Markdown docs
/postman                 Postman collection
```

Namespaces: `App\` maps to `backend/src/`, `Tests\` maps to `backend/tests/`. Every PHP file starts with `declare(strict_types=1);`. Classes are `final` unless designed for extension.

## Running tools on this machine

PHP is not on the bash PATH by default. In Git Bash:

```bash
export PATH="$(cygpath -u "$LOCALAPPDATA")/Microsoft/WinGet/Packages/PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe:$PATH"
~/bin/composer install --working-dir=backend
php backend/bin/migrate.php            # apply pending migrations
php backend/bin/migrate.php --status   # list applied / pending
php backend/bin/seed.php base|dev|demo|purge-demo|counts
php backend/vendor/bin/phpunit -c backend/phpunit.xml
php -S localhost:8000 -t backend/public
```

Root npm scripts wrap these (`npm run migrate`, `npm run seed:dev`, `npm run db:counts`, `npm test`, `npm run dev`). Frontend: `npm run build --prefix frontend`, `npm test --prefix frontend`.

## Database

- Target: Supabase Postgres. App connects as role `diagnocare_app` (has BYPASSRLS). The React app never talks to Supabase.
- `Database::connection()` uses `DB_PORT` (6543, transaction pooler). Always keep `PDO::ATTR_EMULATE_PREPARES = true` there; server-side prepared statements do not survive the transaction pooler. Do not rely on session state (`SET`, temp tables, advisory locks) across statements outside a transaction.
- `Database::migrationConnection()` uses `DB_MIGRATE_PORT` (5432, session pooler) for migrations, seeds and DDL.
- PDO prepared statements with named placeholders only. Never interpolate values into SQL.
- Timezone: sessions run `SET TIME ZONE 'Asia/Kolkata'`; columns are `TIMESTAMPTZ`.

### Naming

- Tables: plural snake_case (`appointments`). Columns: snake_case. FKs: `<singular>_id`. Booleans: `is_*`, `has_*` or a past participle (`verified_visit`). Timestamps: `*_at`.
- Primary keys: `UUID DEFAULT gen_random_uuid()` for entities; `BIGINT GENERATED ALWAYS AS IDENTITY` for append-only logs (`login_attempts`, `report_access_log`, `alert_events`, `audit_log`, `schema_migrations`). `site_settings` uses `key` as PK.
- Constraint names: `<table>_<what>_check`, `<table>_<cols>_unique`; indexes `<table>_<cols>_idx`.
- Enum-like values are `TEXT` + `CHECK`. Current values:
  - `users.role`: patient, receptionist, doctor, admin, referrer
  - `appointments.status`: pending, confirmed, checked_in, in_progress, completed, cancelled, no_show
  - urgency (appointments, referrals): Routine, Priority, Urgent (capitalised)
  - modality (scan_categories, scan_types, slots, checklist_items): USG, CT, BIOPSY
  - `referrals.status`: submitted, accepted, scheduled, completed, report_ready, declined, cancelled
  - `reports.status`: draft, final, amended; `reports.mime_type`: application/pdf, image/jpeg, image/png; size cap 10 MiB
  - `critical_alerts.status`: open, notified, escalated, acknowledged, resolved, cancelled
  - `alert_events.event_type`: raised, notified, resent, escalated, staff_flagged, acknowledged, resolved, cancelled, delivery_failed; `actor_type`: user, system; `channel`: email, in_app, sms_stub, phone
  - `reviews.status`: pending, approved, rejected; rating 1 to 5
  - `checklist_items.answer_type`: yes_no, yes_no_unsure, text, date
  - `report_access_log.action`: upload, view, download, delete, denied
  - `audit_log.action`: dotted lowercase, e.g. `auth.login_failed`, `security.sqli_attempt`, `booking.created`

### Key model rules

- Every table has `created_at`; mutable tables also have `updated_at` maintained by trigger `set_updated_at()`.
- `alert_events` is append-only: triggers call `reject_modification()` on UPDATE, DELETE and TRUNCATE. Users referenced there cannot be deleted; deactivate them (`users.is_active = FALSE`).
- Slots belong to branch + modality + date + start_time (unique). `slots.capacity` and `slots.booked_count` (CHECK `booked_count <= capacity`). Booking must `SELECT ... FOR UPDATE` the slot row inside a transaction, then increment `booked_count`.
- One active booking per patient per slot: partial unique index on `appointments (patient_id, slot_id) WHERE status <> 'cancelled'`. Cancelled rows must have `cancelled_at` set (CHECK).
- `checklist_items` apply either to one `scan_type_id` or to a whole `modality` (exactly one is set). `attention_answers TEXT[]` lists answers that should flag `appointment_checklist_answers.needs_attention`.
- Referrer access to a report: `reports.appointment_id -> appointments.referral_id -> referrals.referrer_id`.
- Encrypted fields end in `_encrypted` (TEXT, AES-256-GCM envelope). Report files: ciphertext in the private bucket at `reports.storage_path`, IV and tag in `encryption_iv` / `encryption_tag` (base64), `key_version` for rotation.
- Auth tokens are stored hashed: `remember_tokens (selector, validator_hash)`, `password_resets.token_hash`, `email_verifications.token_hash` (SHA-256 hex of the random token). Lockout uses `users.failed_login_count`, `users.locked_until` and `login_attempts`.
- `site_settings`: dotted keys (`contact.phone`, `doctor.bio`). `value` NULL with `is_placeholder = TRUE` means unknown. The frontend shows "TODO: add real value" for those only when `import.meta.env.DEV`, and hides them in production. Non-public keys (`is_public = FALSE`) must never be sent to the public API.
- `branches.slug = 'branch-2'` is a placeholder (address `TODO: add real value`, `is_active = FALSE` in base seed; the dev seed activates it).
- `reviews.is_demo = TRUE` rows come only from `seed_demo.sql`. Public endpoints must exclude `is_demo` rows when `APP_ENV=production`.
- RLS is enabled on every table with no policies. Every new table must include `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` in its migration.

### Adding a migration

1. Create `database/migrations/NNN_short_description.sql` with the next number (currently last is `011`).
2. Plain SQL, no comments. Include triggers for `updated_at` and `ENABLE ROW LEVEL SECURITY` for new tables.
3. Run `npm run migrate`. Each file runs in one transaction and is recorded in `schema_migrations` with a SHA-256 checksum.
4. Never edit an applied migration; the runner warns on checksum change. Write a new one instead.

### Seeds

- `seed_base.sql` is production-safe and idempotent (`ON CONFLICT DO NOTHING`): branches, scan categories, 56 scan types, checklist items, FAQs, site settings. No users.
- `seed_dev.php` (mode `dev`, refused when `APP_ENV=production`): one user per role, patient and referrer profiles, activates branch 2, creates 30-minute slots 09:00 to 17:00 Mon to Sat for the next 14 days (USG capacity 2, CT 1, BIOPSY 1). Re-running resets dev passwords and is safe.
- `seed_demo.sql` (mode `demo`, refused in production): four reviews labelled "Demo data", `is_demo = TRUE`. `purge-demo` removes them.

## Dev logins (development database only)

| Role | Email | Password |
|---|---|---|
| admin | admin@diagnocare.test | Admin@Dev2026! |
| doctor | doctor@diagnocare.test | Doctor@Dev2026! |
| receptionist | reception@diagnocare.test | Reception@Dev2026! |
| patient | patient@diagnocare.test | Patient@Dev2026! |
| referrer | referrer@diagnocare.test | Referrer@Dev2026! |

Passwords are Argon2id hashes (`password_hash(..., PASSWORD_ARGON2ID)`). Remove these users before going live.

## API

- Base path: `/api/v1`. JSON only. Resource names are plural kebab-case: `/api/v1/scan-types`, `/api/v1/appointments/{id}`.
- Methods: GET read, POST create or action (`POST /appointments/{id}/cancel` is acceptable for commands), PUT full replace, PATCH partial update, DELETE remove.
- Success envelope (`App\Core\Response::json`):

```json
{ "data": { }, "error": null, "meta": { "page": 1, "per_page": 20, "total": 57 } }
```

  `meta` is optional (pagination only).
- Error envelope (`App\Core\Response::error`):

```json
{ "data": null, "error": { "code": "VALIDATION_FAILED", "message": "Please correct the highlighted fields.", "fields": { "email": "Enter a valid email address." } } }
```

- Error codes (UPPER_SNAKE): `VALIDATION_FAILED` 422, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409 (e.g. slot full), `CSRF_INVALID` 419, `RATE_LIMITED` 429, `SERVER_ERROR` 500. Throw `App\Exceptions\AppException` subclasses; the global handler converts them. Never expose stack traces when `APP_ENV=production`.
- JSON field names are snake_case in both directions; TypeScript types mirror them in `frontend/src/types`.
- Health check: `GET /api/v1/health` returns `{ "data": { "status": "ok" }, "error": null }`.
- Frontend calls go through `apiRequest<T>()` in `frontend/src/api/client.ts` with `credentials: 'include'`. `VITE_API_BASE_URL` defaults to `http://localhost:8000/api/v1`.

## Node alerts service

ESM (`"type": "module"`), Express 5, `pg` pool. Reads `services/alerts/.env` then the repo root `.env` (dotenv does not override real env vars). Same JSON envelope. Port `ALERTS_SERVICE_PORT` (default 4000). Health: `GET /health`.

## Frontend

React 18, TypeScript strict, React Router v6, Redux Toolkit as the only global state store (auth session, booking draft, alerts). Context is allowed only for theme/locale. Vitest + Testing Library with `globals: true` and jsdom. Brand tokens live as CSS variables in `src/index.css` (`--color-navy`, `--color-orange`, `--color-teal-tint`, `--color-lavender-tint`).
