# Conventions

The rules the team followed, and the layout and naming that a new contributor needs to know.

## Project rules

- No code comments in code files (PHP, TS, JS, SQL, CSS, Dockerfiles, YAML). Explanations go in Markdown.
- No invented reviews, ratings, credentials, phone numbers, fees, hours or statistics. Values the centre has not supplied come from `site_settings` and `branches` and are flagged `is_placeholder = TRUE`.
- No fetal-sex field, label or feature anywhere.
- Secrets are never committed. Only `.env.example` files with placeholder values are tracked, and secret values are not printed in logs or output.

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
/api                     Node.js 22 REST API (ESM), the deployed one
  src/server.js          process entry: environment, listen, graceful shutdown
  src/app.js             createKernel / createApp, the Express shell
  src/container.js       builds models, services, mailer, limiter and validator once
  src/routes.js          the list of modules; builds all routes under /api/v1
  src/core/              config, env, database, router, pipeline, kernel, request, response, errors,
                         error-handler, session, cookie, csrf, logger, time
  src/middleware/        cors, security-headers, handle-errors, match-route, start-session, authenticate,
                         csrf, require-auth, role, verified-email, rate-limit
  src/modules/<name>/    index.js (routes) and the controllers for one area
  src/models/            one class per table family
  src/services/          business logic (booking, reports, alerts, auth, encryption, mail, storage)
  src/validation/        validator, sanitizer, request-validator
  test/                  node:test suites; test/support/harness.js has a fake database and a test client
/backend                 the same API in plain PHP 8.3 (reference implementation, not deployed)
  public/index.php       single front controller
  config/                bootstrap.php, app.php, container.php (bindings and global middleware)
  routes/api.php         every API route
  src/Core, Controllers, Models, Middleware, Services, Validation, Exceptions
  templates/emails/      email templates
  bin/                   CLI scripts: migrate.php, seed.php, storage-setup.php, rotate-encryption.php, generate-slots.php
  tests/Unit/            PHPUnit tests, namespace Tests\Unit
/services/alerts         Node.js + Express (ESM): escalation, reminders, status page, rotating log
/database/migrations     NNN_snake_case.sql, applied in order
/database/seeds          seed_base.sql, seed_client.sql, seed_dev.php, seed_demo.sql
/docs                    Markdown docs
/postman                 Postman collection
/tests/flow              end-to-end journey script
```

PHP namespaces: `App\` maps to `backend/src/` and `Tests\` maps to `backend/tests/`. Every PHP file starts with `declare(strict_types=1);` and classes are `final` unless designed for extension. JavaScript files are ES modules with named exports.

## Running the tools

```bash
npm run setup                 # root, api, frontend and alerts dependencies
npm run setup:php             # composer install for backend/ (needed by migrate and seed)
npm run dev                   # API :8000, frontend :5173, alerts :4000
npm test                      # Node API, frontend and worker tests
npm run test:api:php          # PHPUnit
npm run migrate               # apply pending migrations (PHP runner)
npm run migrate:status        # list applied and pending
npm run seed | seed:dev | seed:demo | seed:purge-demo | db:counts
npm run dev:api:php           # php -S localhost:8000 -t backend/public
```

PHP 8.3 must be on the PATH for the migrate and seed commands and for the PHP reference API. Frontend: `npm run build --prefix frontend`, `npm test --prefix frontend`.

## Database

- Target: Supabase Postgres. The app connects as role `diagnocare_app` (has BYPASSRLS). The React app never talks to Supabase.
- Node API: `pg` pool (`api/src/core/database.js`) with parameterised queries (`$1`, `$2`). Values are never interpolated into SQL.
- PHP: `Database::connection()` uses `DB_PORT` (6543, transaction pooler) with `PDO::ATTR_EMULATE_PREPARES = true`, because server-side prepared statements do not survive the transaction pooler. `Database::migrationConnection()` uses `DB_MIGRATE_PORT` (5432, session pooler) for migrations, seeds and DDL. Named placeholders only.
- Session state (`SET`, temp tables, advisory locks) must not be relied on across statements outside a transaction.
- Timezone: `Asia/Kolkata`; columns are `TIMESTAMPTZ`.

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
  - `alert_events.event_type`: raised, notified, resent, escalated, staff_flagged, acknowledged, phone_contacted, resolved, cancelled, delivery_failed; `actor_type`: user, system; `channel`: email, in_app, sms_stub, phone
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
- `site_settings`: dotted keys (`contact.phone`, `doctor.bio`). `value` NULL with `is_placeholder = TRUE` means unknown. The frontend shows a placeholder badge for those only in development builds and hides them in production. Non-public keys (`is_public = FALSE`) must never be sent to the public API.
- Branches are `bhosari`, `moshi`, `pimple-gurav`, `moi` (migration `019_branches_official.sql`). Each has `phone` and `phone_secondary`, and a Google Maps search url in `maps_url`; the full address up to the PIN is in `address_line` and the PIN in `postal_code`.
- `reviews.is_demo = TRUE` rows come only from `seed_demo.sql`. Public endpoints must exclude `is_demo` rows when `APP_ENV=production`.
- RLS is enabled on every table with no policies. Every new table must include `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` in its migration.

### Adding a migration

1. Create `database/migrations/NNN_short_description.sql` with the next number (the last one is `022`; `016` is unused).
2. Plain SQL, no comments. Include triggers for `updated_at` and `ENABLE ROW LEVEL SECURITY` for new tables.
3. Run `npm run migrate`. Each file runs in one transaction and is recorded in `schema_migrations` with a SHA-256 checksum. The runner is the PHP script `backend/bin/migrate.php`; the Node API has no migration runner.
4. Never edit an applied migration; the runner warns on checksum change. Write a new one instead.

### Seeds

- `seed_base.sql` is production-safe and idempotent (`ON CONFLICT DO NOTHING`): branches, scan categories, 56 scan types, checklist items, FAQs, site settings. No users.
- `seed_dev.php` (mode `dev`, refused when `APP_ENV=production`): one user per role (all with the password from `DEV_SEED_PASSWORD`), patient and referrer profiles, creates 30-minute slots 08:00 to 22:00 Mon to Sat for the next 30 days at every active branch (USG capacity 2, CT 1, BIOPSY 1). Re-running resets dev passwords and is safe.
- `seed_demo.sql` (mode `demo`, refused in production): four reviews labelled "Demo data", `is_demo = TRUE`. `purge-demo` removes them.

## Dev logins (development database only)

`npm run seed:dev` creates `admin@`, `doctor@`, `reception@`, `patient@` and `referrer@` accounts on the reserved `diagnocare.test` domain. They all use the password set in `DEV_SEED_PASSWORD` in `.env` (at least 10 characters), stored as an Argon2id hash. The seed stops if the variable is empty or `APP_ENV=production`. Remove these users before going live.

## API

- Base path: `/api/v1`. JSON only. Resource names are plural kebab-case: `/api/v1/scan-types`, `/api/v1/appointments/{id}`.
- Methods: GET read, POST create or action (`POST /appointments/{id}/cancel` is acceptable for commands), PUT full replace, PATCH partial update, DELETE remove.
- Success envelope (`ok()` and `created()` in `api/src/core/response.js`, `App\Core\Response::json` in PHP; controllers return the response object and the kernel sends it):

```json
{ "data": { }, "error": null, "meta": { "page": 1, "per_page": 20, "total": 57 } }
```

  `meta` is optional (pagination only).
- Error envelope (`api/src/core/error-handler.js`, `App\Core\Response::error` in PHP):

```json
{ "data": null, "error": { "code": "VALIDATION_FAILED", "message": "Please correct the highlighted fields.", "fields": { "email": "Enter a valid email address." } } }
```

- Error codes (UPPER_SNAKE): `BAD_REQUEST` 400 (malformed JSON), `VALIDATION_FAILED` 422, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `METHOD_NOT_ALLOWED` 405 (with `Allow` header), `CONFLICT` 409 (e.g. slot full), `PAYLOAD_TOO_LARGE` 413, `CSRF_INVALID` 419, `RATE_LIMITED` 429 (with `Retry-After`), `SERVER_ERROR` 500. In development a 500 also carries `error.debug` (class, message, file, line; never the trace). Throw `App\Exceptions\AppException` subclasses; the global handler converts them. Never expose stack traces when `APP_ENV=production`.
- JSON field names are snake_case in both directions; TypeScript types mirror them in `frontend/src/types`.
- Health check: `GET /api/v1/health` returns `{ "data": { "status": "ok" }, "error": null }`.
- Timestamps in JSON are ISO 8601 with offset (`toIso()` in `api/src/core/time.js`, `Model::iso()` in PHP), e.g. `2026-10-08T20:52:56+05:30`.
- Frontend calls go through `api.get/post/put/patch/delete` in `frontend/src/api/client.ts` (`credentials: 'include'`, automatic CSRF header, one retry after `CSRF_INVALID`). `VITE_API_BASE_URL` defaults to `/api/v1`; the Vite dev server proxies `/api` to `http://localhost:8000`, so cookies are same-origin in development.

## Request lifecycle

In the Node API, `app.js` hands every request to the kernel (`api/src/core/kernel.js`), which runs the global middleware from `api/src/middleware/index.js`. In the PHP version `public/index.php` builds `Config` and the `Container`, registers `ErrorHandler`, creates `Request::fromGlobals()` and calls `Kernel::handle()`. The order is the same in both. Names below are the PHP classes; the Node files are `cors.js`, `security-headers.js`, `handle-errors.js`, `match-route.js`, `start-session.js`, `authenticate.js` and `csrf.js`. Global middleware, in order:

1. `CorsMiddleware`: allowlist `CORS_ALLOWED_ORIGINS` (default `FRONTEND_URL`), credentials, answers preflight, rejects unsafe requests from a foreign `Origin` with 403.
2. `SecurityHeadersMiddleware`: CSP `default-src 'none'`, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, `Cache-Control: no-store`, HSTS when `APP_ENV=production`.
3. `HandleErrorsMiddleware`: any exception becomes the JSON error envelope, so CORS and security headers still apply.
4. `MatchRouteMiddleware`: 404 / 405 before a session is started.
5. `StartSessionMiddleware`: session cookie `dc_session`, HttpOnly, `SameSite` and `Secure` from `SESSION_SAMESITE` and `SESSION_SECURE`, idle timeout 30 min, absolute lifetime 12 h. The Node API stores sessions in the `http_sessions` table; PHP uses files in `backend/storage/sessions`.
6. `AuthenticateMiddleware`: loads the session user from the DB on every request; drops the session if the user is inactive, the role changed, or the password changed after login; otherwise tries the remember-me cookie.
7. `CsrfMiddleware`: POST, PUT, PATCH and DELETE need header `X-CSRF-Token` equal to the token from `GET /api/v1/auth/csrf` (HMAC-SHA256 of a per-session seed with `CSRF_SECRET`).

Route middleware aliases (`routeMiddlewareFactories` in `api/src/middleware/index.js`, `backend/config/container.php` in PHP): `auth` (401 for guests), `role:admin,doctor` (403 and a `security.forbidden` audit row), `verified` (403 until the email is verified), `throttle:name,max,minutes` (DB-backed fixed window per user id or IP in `rate_limits`, 429 with `Retry-After`).

### Adding an endpoint (Node API)

1. Create or open a module under `api/src/modules/<name>/` and list the route in its `index.js`, then make sure the module is in the list in `api/src/routes.js`:

```js
export const routes = group('/appointments', ['auth'], [
  patch('/{id:uuid}/status', controller.status, ['role:receptionist,doctor,admin']),
])
```

   Parameter types are `{id:uuid}`, `{n:int}`, `{slug:slug}` or untyped `{name}`.
2. Write the handler in the module's controller as `async (req, app) => response`, returning `ok()`, `created()` or `noContent()`. Dependencies (models, services, config) come from `app`, which is built once in `api/src/container.js`.
3. Validate before any write: `const data = await app.validate(req, { field: 'required|min:2' })`. It returns only the declared fields (cleaned and normalised) and throws a validation error (422 with `fields`).
4. Ownership checks (IDOR) belong in the controller or service: load the record, compare with the signed-in user's id and role, and throw `NotFoundError` for other people's records.
5. Business logic goes in `api/src/services` and SQL in `api/src/models` (extend `Model`, set `table` and `fillable`). Multi-step writes use a transaction.
6. Audit important actions with `app.audit.log('booking.created', req, { entity_type, entity_id, metadata })`.
7. Throw the error classes from `api/src/core/errors.js` for expected failures.
8. Add a test in `api/test/` using the harness in `api/test/support/harness.js`.

### Adding an endpoint (PHP reference)

1. Add the route in `backend/routes/api.php` inside the `/api/v1` group, for example
   `$router->patch('/appointments/{id:uuid}', [AppointmentController::class, 'update'], ['auth', 'role:patient,receptionist']);`
   Parameter types: `{id:uuid}`, `{n:int}`, `{slug:slug}`, or untyped `{name}`. Read them with `$request->param('id')`.
2. Controller in `src/Controllers`: `final class XController extends Controller`, dependencies through the constructor (autowired by `Container`). Each action takes `Request` and returns `Response` via `$this->ok()`, `$this->created()`, `$this->message()` or `$this->noContent()`.
3. Validate before any write: `$data = $this->validate($request, [...rules])`. It reads the JSON body for unsafe methods and the query string for GET, returns only the declared fields (cleaned and normalised) and throws `ValidationException` (422 with `fields`). Never read `$request->body()` directly for writes.
4. Ownership checks (IDOR) belong in the controller or service: load the record, compare with `$request->user()['id']` and role, and throw `NotFoundException` for other people's records.
5. Business logic in `src/Services`, SQL in `src/Models` (extend `Model`, set `TABLE` and `FILLABLE`; `create`, `update`, `find`, `delete`, `transaction`, plus `fetchOne`, `fetchAll`, `fetchValue`, `execute` with named placeholders). Postgres booleans go through `Model::flag()`.
6. Audit important actions: inject `App\Services\AuditLogger` and call `$audit->log('booking.created', $request, ['entity_type' => 'appointment', 'entity_id' => $id, 'metadata' => [...]])`.
7. Throw `App\Exceptions\*` for expected failures; never echo or exit.

### Validation rules (`api/src/validation/validator.js`, `App\Validation\Validator` in PHP)

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
- Mail (Node): `MailService` with `LogMailer` (`MAIL_DRIVER=log`, writes to `api/storage/logs/mail.log`) and an SMTP mailer built on nodemailer (`MAIL_DRIVER=smtp`), in `api/src/services/mail/`. Mail failures are logged, never fatal.
- Mail (PHP): `App\Services\Mail\Mailer` with `LogMailer` (`MAIL_DRIVER=log`, writes to `backend/storage/logs/mail.log`) and `SmtpMailer` (PHPMailer, `MAIL_DRIVER=smtp`). Send with `MailService::sendTemplate($to, $name, 'template-name', $vars)`; templates escape with `$e()`. Mail failures are logged, never fatal.

### RBAC map

| Area | API | Frontend | Roles |
|---|---|---|---|
| Patient | `/api/v1/dashboards/patient` | `/portal/patient` | patient |
| Doctor | `/api/v1/dashboards/doctor` | `/portal/doctor` | doctor, admin |
| Reception | `/api/v1/dashboards/receptionist` | `/portal/reception` | receptionist, admin |
| Admin | `/api/v1/dashboards/admin` | `/portal/admin` | admin |
| Referrer | `/api/v1/dashboards/referrer` | `/portal/referrer` | referrer |

Keep `frontend/src/lib/roles.ts` (`ROLE_HOME`, `AREA_ROLES`) in sync with the API route middleware.

## Node alerts service

ESM (`"type": "module"`), Express 5, `pg` pool. Reads `services/alerts/.env` then the repo root `.env` (dotenv does not override real env vars). Same JSON envelope. Port `ALERTS_SERVICE_PORT` (default 4000). Health: `GET /health`.

## Frontend

React 18, TypeScript strict, React Router v6, Redux Toolkit as the only global state store (auth session, booking draft, alerts). Context is used only for the theme (`src/context/ThemeContext.tsx`, persisted in a `theme` cookie written by the browser, `SameSite=Lax`, one year; the server never reads it). Vitest + Testing Library with `globals: true` and jsdom. Brand tokens live as CSS variables in `src/index.css` (`--color-navy`, `--color-orange`, `--color-teal-tint`, `--color-lavender-tint`); `:root[data-theme='dark']` overrides them.

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
