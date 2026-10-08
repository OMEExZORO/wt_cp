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
  config/app.php         app config array (read through App\Core\Config, dotted keys)
  config/container.php   service container bindings and the global middleware list
  routes/api.php         every API route
  templates/emails/      email templates (layout.php + one file per message)
  src/Core/              Env, Config, Database, Request, Response, Router, Route, Kernel, Pipeline,
                         Container, Middleware (interface), Session, Cookie, Csrf, ErrorHandler, Logger
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

1. Create `database/migrations/NNN_short_description.sql` with the next number (currently last is `012`).
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
- Success envelope (`App\Core\Response::json`, which returns a `Response` object; controllers return it and the Kernel sends it):

```json
{ "data": { }, "error": null, "meta": { "page": 1, "per_page": 20, "total": 57 } }
```

  `meta` is optional (pagination only).
- Error envelope (`App\Core\Response::error`):

```json
{ "data": null, "error": { "code": "VALIDATION_FAILED", "message": "Please correct the highlighted fields.", "fields": { "email": "Enter a valid email address." } } }
```

- Error codes (UPPER_SNAKE): `BAD_REQUEST` 400 (malformed JSON), `VALIDATION_FAILED` 422, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `METHOD_NOT_ALLOWED` 405 (with `Allow` header), `CONFLICT` 409 (e.g. slot full), `PAYLOAD_TOO_LARGE` 413, `CSRF_INVALID` 419, `RATE_LIMITED` 429 (with `Retry-After`), `SERVER_ERROR` 500. In development a 500 also carries `error.debug` (class, message, file, line; never the trace). Throw `App\Exceptions\AppException` subclasses; the global handler converts them. Never expose stack traces when `APP_ENV=production`.
- JSON field names are snake_case in both directions; TypeScript types mirror them in `frontend/src/types`.
- Health check: `GET /api/v1/health` returns `{ "data": { "status": "ok" }, "error": null }`.
- Timestamps in JSON are ISO 8601 with offset (`Model::iso()`), e.g. `2026-10-08T20:52:56+05:30`.
- Frontend calls go through `api.get/post/put/patch/delete` in `frontend/src/api/client.ts` (`credentials: 'include'`, automatic CSRF header, one retry after `CSRF_INVALID`). `VITE_API_BASE_URL` defaults to `/api/v1`; the Vite dev server proxies `/api` to `http://localhost:8000`, so cookies are same-origin in development.

## Backend request lifecycle

`public/index.php` builds `Config` and the `Container`, registers `ErrorHandler`, creates `Request::fromGlobals()` and calls `Kernel::handle()`. Global middleware, in order:

1. `CorsMiddleware`: allowlist `CORS_ALLOWED_ORIGINS` (default `FRONTEND_URL`), credentials, answers preflight, rejects unsafe requests from a foreign `Origin` with 403.
2. `SecurityHeadersMiddleware`: CSP `default-src 'none'`, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, `Cache-Control: no-store`, HSTS when `APP_ENV=production`.
3. `HandleErrorsMiddleware`: any exception becomes the JSON error envelope, so CORS and security headers still apply.
4. `MatchRouteMiddleware`: 404 / 405 before a session is started.
5. `StartSessionMiddleware`: native PHP session `dc_session`, HttpOnly, SameSite Lax in dev and None + Secure in prod, idle timeout 30 min, absolute lifetime 12 h, files in `backend/storage/sessions`.
6. `AuthenticateMiddleware`: loads the session user from the DB on every request; drops the session if the user is inactive, the role changed, or the password changed after login; otherwise tries the remember-me cookie.
7. `CsrfMiddleware`: POST, PUT, PATCH and DELETE need header `X-CSRF-Token` equal to the token from `GET /api/v1/auth/csrf` (HMAC-SHA256 of a per-session seed with `CSRF_SECRET`).

Route middleware aliases (`config/container.php`): `auth` (401 for guests), `role:admin,doctor` (403 and a `security.forbidden` audit row), `verified` (403 until the email is verified), `throttle:name,max,minutes` (DB-backed fixed window per user id or IP in `rate_limits`, 429 with `Retry-After`).

### Adding an endpoint

1. Add the route in `backend/routes/api.php` inside the `/api/v1` group, for example
   `$router->patch('/appointments/{id:uuid}', [AppointmentController::class, 'update'], ['auth', 'role:patient,receptionist']);`
   Parameter types: `{id:uuid}`, `{n:int}`, `{slug:slug}`, or untyped `{name}`. Read them with `$request->param('id')`.
2. Controller in `src/Controllers`: `final class XController extends Controller`, dependencies through the constructor (autowired by `Container`). Each action takes `Request` and returns `Response` via `$this->ok()`, `$this->created()`, `$this->message()` or `$this->noContent()`.
3. Validate before any write: `$data = $this->validate($request, [...rules])`. It reads the JSON body for unsafe methods and the query string for GET, returns only the declared fields (cleaned and normalised) and throws `ValidationException` (422 with `fields`). Never read `$request->body()` directly for writes.
4. Ownership checks (IDOR) belong in the controller or service: load the record, compare with `$request->user()['id']` and role, and throw `NotFoundException` for other people's records.
5. Business logic in `src/Services`, SQL in `src/Models` (extend `Model`, set `TABLE` and `FILLABLE`; `create`, `update`, `find`, `delete`, `transaction`, plus `fetchOne`, `fetchAll`, `fetchValue`, `execute` with named placeholders). Postgres booleans go through `Model::flag()`.
6. Audit important actions: inject `App\Services\AuditLogger` and call `$audit->log('booking.created', $request, ['entity_type' => 'appointment', 'entity_id' => $id, 'metadata' => [...]])`.
7. Throw `App\Exceptions\*` for expected failures; never echo or exit.

### Validation rules (`App\Validation\Validator`)

String or array syntax: `'required|name|min:2|max:120'`, or `['required', 'regex:/^[A-Z]{3}$/']` when the pattern contains `|`.

| Rule | Meaning |
|---|---|
| `required`, `nullable`, `sometimes` | presence; `nullable` returns null for blanks; `sometimes` skips absent keys (PATCH) |
| `string` (default), `text` | single line (whitespace collapsed) / multi-line text |
| `name` | letters (any script), spaces, `.` `'` `-` |
| `email` | `filter_var` plus domain format; lowercased; DNS check when `MAIL_CHECK_MX=true` |
| `phone` | Indian mobile `^[6-9]\d{9}$`, optional `+91`, spaces and hyphens allowed; normalised to 10 digits |
| `date`, `before:today`, `after:1900-01-01`, `before_or_equal`, `after_or_equal` | `YYYY-MM-DD` |
| `time` | `HH:MM` or `HH:MM:SS`, returns `HH:MM` |
| `uuid`, `token` (64 hex), `registration_number` | identifiers |
| `in:a,b,c` | enum (case-sensitive) |
| `integer`, `min`, `max` | for integers `min`/`max` are values, for strings they are lengths |
| `boolean`, `accepted` | `accepted` must be true (consent) |
| `password` | 10 to 128 characters, upper, lower, digit, symbol; never trimmed or scanned |
| `raw` | no cleaning or scanning (current password on login) |
| `confirmed`, `different:field` | `<field>_confirmation` must match / must differ from another field |

Every string field without `raw`, `password` or `token` is cleaned by `Sanitizer::clean()` (trim, collapse whitespace, strip control and zero-width characters) and scanned by `Sanitizer::detectThreat()` (HTML/script payloads and SQL meta-patterns such as `' OR '1'='1`, `;--`, `DROP TABLE`, `UNION SELECT`, also after URL decoding). A hit rejects the field with "This field contains characters or patterns that are not allowed." and `RequestValidator` writes `security.sqli_attempt` or `security.xss_attempt` to `audit_log` with the field name and a 200-character sample. Strings default to `max:255` unless a `max` is given. The same patterns live in `frontend/src/lib/validation.ts`; keep both in sync.

### Auth model

- Login: `password_verify` (Argon2id, rehash when needed), generic "Incorrect email or password.", `session_regenerate_id(true)`. Five failures lock the account for 15 minutes (`users.failed_login_count`, `users.locked_until`); unknown emails are throttled the same way through `login_attempts`; the route is also throttled per IP (20 per 10 minutes).
- Remember me: cookie `dc_remember` = `selector.validator` (HttpOnly, 30 days). The DB stores the selector and the SHA-256 of the validator. Each use rotates the validator; the previous hash is accepted for 60 s (parallel requests); any other mismatch is treated as theft and deletes every token of that user (`auth.remember_token_theft`).
- Password change or reset sets `password_changed_at`, revokes all remember tokens and invalidates every other session.
- Email verification and password reset tokens: 32 random bytes as hex in the email link, SHA-256 in the DB, single use; verification 48 h, reset 60 min. Login is allowed before verification; put the `verified` middleware on features that need a verified email.
- Mail: `App\Services\Mail\Mailer` with `LogMailer` (`MAIL_DRIVER=log`, writes to `backend/storage/logs/mail.log`) and `SmtpMailer` (PHPMailer, `MAIL_DRIVER=smtp`). Send with `MailService::sendTemplate($to, $name, 'template-name', $vars)`; templates escape with `$e()`. Mail failures are logged, never fatal.

### RBAC map

| Area | API | Frontend | Roles |
|---|---|---|---|
| Patient | `/api/v1/dashboards/patient` | `/portal/patient` | patient |
| Doctor | `/api/v1/dashboards/doctor` | `/portal/doctor` | doctor, admin |
| Reception | `/api/v1/dashboards/receptionist` | `/portal/reception` | receptionist, admin |
| Admin | `/api/v1/dashboards/admin` | `/portal/admin` | admin |
| Referrer | `/api/v1/dashboards/referrer` | `/portal/referrer` | referrer |

Keep `frontend/src/lib/roles.ts` (`ROLE_HOME`, `AREA_ROLES`) in sync with the backend route middleware.

## Node alerts service

ESM (`"type": "module"`), Express 5, `pg` pool. Reads `services/alerts/.env` then the repo root `.env` (dotenv does not override real env vars). Same JSON envelope. Port `ALERTS_SERVICE_PORT` (default 4000). Health: `GET /health`.

## Frontend

React 18, TypeScript strict, React Router v6, Redux Toolkit as the only global state store (auth session, booking draft, alerts). Context is used only for the theme (`src/context/ThemeContext.tsx`, persisted in a `theme` cookie written by the browser, `SameSite=Lax`, one year; the server never reads it). Vitest + Testing Library with `globals: true` and jsdom. Brand tokens live as CSS variables in `src/index.css` (`--color-navy`, `--color-orange`, `--color-teal-tint`, `--color-lavender-tint`); `:root[data-theme='dark']` overrides them. Phase 3 replaces the placeholder header, footer and home page styling.

```
src/api/client.ts        api.get/post/put/patch/delete, ApiError (status, code, fields, retryAfter), CSRF handling, setUnauthorizedHandler
src/api/auth.ts          authApi: one typed function per auth endpoint
src/types/               api.ts (envelope, error codes), auth.ts (User, Role, request and response types)
src/app/store.ts         setupStore(preloadedState) and the app store; reducers auth, booking, alerts
src/features/auth        authSlice: user, status idle|loading|authenticated|guest, sessionExpired; thunks fetchMe, login, register, logout
src/features/booking     bookingSlice: draft (branch, scan type, date, slot, urgency, checklist, consent) and step
src/features/alerts      alertsSlice: banner items and dismissed ids
src/context/             ThemeContext (the only React context)
src/components/          ErrorBoundary, PageLoader, ProtectedRoute (roles prop), GuestRoute, layout/*, form/*
src/hooks/               useForm (useReducer, client validation, server field errors), useApi / useApiQuery
src/lib/                 validation.ts (rules mirroring the PHP Validator), roles.ts, cookies.ts
src/pages/               route components, all loaded with React.lazy in App.tsx
src/test/utils.tsx       renderApp(route, preloadedState), mockApi(handler, me), makeUser(role)
```

Routing: `PublicLayout` (header, footer with the PCPNDT notice and disclaimer) wraps `/`, `/login`, `/register`, `/forgot-password` (these three inside `GuestRoute`, which sends signed-in users to their dashboard or to the page they originally asked for), `/reset-password?token=`, `/verify-email?token=`, `/403` and the 404 page. `/portal` is wrapped in `ProtectedRoute` then `PortalLayout`; each dashboard has its own `ProtectedRoute roles={[...]}`. Guests go to `/login`, wrong roles to `/403`. A 401 from any call other than `me`/`login` dispatches `sessionExpired`.

### Adding a page

1. Create `src/pages/<area>/<Name>Page.tsx` with a default export.
2. Register it in `src/App.tsx` with `const NamePage = lazy(() => import('./pages/area/NamePage'))` and a `<Route>` under `PublicLayout`, `GuestRoute` or the `/portal` tree. Wrap role-restricted portal pages in `<Route element={<ProtectedRoute roles={[...]} />}>`.
3. Forms: `const form = useForm({ initialValues, validators })` with validators defined at module level from `lib/validation.ts`; spread `form.field('name')` into `TextField` / `SelectField` and `form.checkbox('name')` into `CheckboxField`; use `SubmitButton disabled={!form.isValid}`; on `ApiError` call `form.setServerErrors(error.fields)`.
4. Add a test next to the page (`*.test.tsx`) using `mockApi` and `renderApp`.

### Adding a slice or API module

1. Types for every response in `src/types/<resource>.ts` (snake_case fields, as the API sends them).
2. Functions in `src/api/<resource>.ts` using `api.*`.
3. Slice in `src/features/<name>/<name>Slice.ts` with `createSlice` / `createAsyncThunk` (`rejectWithValue` with `{ code, message, fields }`), then add the reducer to `rootReducer` in `src/app/store.ts`. Use `useAppSelector` / `useAppDispatch` from `src/app/hooks.ts`.
4. Server data that only one page needs can stay in `useApiQuery` instead of Redux.
