# DiagnoCare API (Node.js port)

Node 22+, ESM, Express 5, `pg`. Wire-compatible port of the PHP API in `backend/`: same routes under `/api/v1`, JSON envelope, status and error codes, cookies, CSRF scheme, validation messages, DB tables. The PHP backend stays untouched until cutover.

## Run and test

```
cd api
npm install
npm start            # PORT (default 8000), loads api/.env, backend/.env, then ../.env (never overrides real env vars)
npm run dev          # node --watch
npm test             # node --test, no database needed
LIVE_DB_TESTS=1 npm test   # adds read-only checks against DATABASE_URL / DB_*
```

Env var names are identical to `backend/.env.example` and `render.yaml` (`APP_ENV`, `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_SECRET`, `DATABASE_URL` or `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/DB_SSLMODE`, `SESSION_*`, `REMEMBER_DAYS`, `LOGIN_*`, `MAIL_*`, `SMTP_*`, `ENCRYPTION_KEY`, `ENCRYPTION_KEY_VERSION`, `ENCRYPTION_KEYS_PREVIOUS`, `STORAGE_*`, `SUPABASE_*`, `TRUST_PROXY`, `APP_TIMEZONE`). New optional ones: `PORT`, `SESSION_STORE` (`database` default, `memory` for local), `LOG_PATH`, `MAX_BODY_BYTES`, `DB_POOL_MAX`.

Sessions need the table from `database/migrations/019_http_sessions.sql` (apply with `npm run migrate` from the repo root). PHP sessions are files on disk, so a PHP session cookie is not valid in Node and vice versa; users sign in again at cutover.

## Layout

```
src/server.js            process entry (env, listen, graceful shutdown)
src/app.js               createKernel(options) / createApp(options): factories used by tests
src/container.js         core wiring: models, auth services, mail, limiter, validator
src/routes.js            ONE list of modules; buildRoutes() prefixes /api/v1
src/core/                config, env, database (Db/PgDb), router, pipeline, kernel, request, response,
                         errors, error-handler, session, cookie, csrf, logger, time, http
src/middleware/          cors, security-headers, handle-errors, match-route, start-session, authenticate,
                         csrf, require-auth (auth), role, verified-email (verified), rate-limit (throttle)
src/validation/          sanitizer, validator, request-validator (rules identical to PHP)
src/models/              one class per table (Model base: find/create/update/delete/using(tx))
src/services/            shared services (auth, password hashing, encryption, mail, limiter, audit)
src/modules/<name>/      index.js exports `routes` (+ optional `register(app)`), plus controllers
test/                    node:test suites; test/support/harness.js has FakeDb, makeApp, Client
```

Request pipeline (same order as PHP `Kernel`): `cors -> securityHeaders -> handleErrors -> matchRoute -> startSession -> authenticate -> csrf -> route middleware -> handler`. A foreign origin on an unsafe method is rejected by `cors` before `handleErrors`, so that 403 has no security headers, exactly like PHP.

## Adding or porting a module

1. Work only inside `src/modules/<your-module>/` (a stub with `export const routes = []` already exists and is already registered in `src/routes.js`). Models go in `src/models/`, shared services in `src/services/`; create new files, do not edit existing ones except to add exports.
2. Define routes declaratively, mirroring `backend/routes/api.php`. Paths are relative to `/api/v1`:

```js
import { get, group, patch, post } from '../../core/router.js'
import * as controller from './appointments.controller.js'

export const routes = group('/appointments', ['auth'], [
  get('', controller.index, ['role:patient,receptionist,doctor,admin']),
  post('', controller.store, ['role:patient,receptionist,admin', 'verified', 'throttle:booking,30,60']),
  get('/{id:uuid}', controller.show, ['role:patient,receptionist,doctor,admin']),
])

export const register = (app) => {
  app.models.appointments = new Appointment(app.db, { timezone: app.config.timezone })
  app.services.booking = new BookingService({ db: app.db, config: app.config })
}
```

   Route helpers: `get/post/put/patch/del(path, handler, middleware[])`, `group(prefix, middleware[], routes[])` (nestable, arrays are flattened). Param types: `{id:uuid}`, `{x:int}`, `{x:slug}`, bare `{x}`. Route order matters (first match wins, as in PHP). Group and route middleware concatenate in PHP order.
3. `register(app)` runs once at boot, before routes are compiled. Attach models to `app.models`, services to `app.services`. Never touch `container.js`.
4. A handler is `async (req, app) => ApiResponse`:

```js
import { created, ok } from '../../core/response.js'
import { requireUser } from '../../core/http.js'

export const store = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, { slot_id: 'required|uuid', notes: 'nullable|text|max:500' })
  const appointment = await app.services.booking.book(user, data, req)
  return created({ appointment })
}
```

   `req` (ApiRequest): `method`, `path`, `ip`, `userAgent`, `header(name)`, `query(key?)`, `body()`, `input(key)`, `all()`, `param(name)`, `cookie(name)`, `user` (row from `users` or `null`), `session`, `csrf`, `rawBody` (Buffer, for uploads), `setCookie(line)`. `app` carries `config`, `db`, `logger`, `audit`, `limiter`, `mail`, `models`, `services`, `cookies`, `validate`.
   Responses: `ok(data, status?, meta?)`, `created(data)`, `message(text, status?)`, `noContent()`, `ApiResponse.error(...)`, `ApiResponse.binary(buffer, status, headers)` for downloads.
5. Do not use `res`/Express directly. Handlers return a response or throw; the kernel renders errors.
6. Multipart uploads: `req.rawBody` holds the raw bytes; add `busboy` to `package.json` and parse inside the reports/doctor-photo modules (limit is `MAX_BODY_BYTES`, default 12 MB).

## Errors

Throw from `src/core/errors.js`; `ErrorHandler` renders `{"data":null,"error":{code,message,fields?,...extra}}` like PHP.

| Class | HTTP | code |
|---|---|---|
| `BadRequestError` | 400 | BAD_REQUEST |
| `AuthenticationError` | 401 | UNAUTHENTICATED |
| `AuthorizationError` | 403 | FORBIDDEN |
| `NotFoundError` | 404 | NOT_FOUND |
| `MethodNotAllowedError(allowed)` | 405 (+`Allow`) | METHOD_NOT_ALLOWED |
| `ConflictError` | 409 | CONFLICT |
| `SlotFullError(message, suggestion, slot)` | 409 | CONFLICT (+`reason`, `suggestion`) |
| `PayloadTooLargeError` | 413 | PAYLOAD_TOO_LARGE |
| `CsrfError` | 419 | CSRF_INVALID |
| `ValidationError(fields)` / `ValidationError.withField(f, msg)` | 422 | VALIDATION_FAILED |
| `RateLimitError(message, retryAfterSeconds)` | 429 (+`Retry-After`) | RATE_LIMITED |
| anything else | 500 | SERVER_ERROR (adds `debug` when `APP_DEBUG` outside production) |

`EncryptionError` and `StorageError` are plain `Error`s (500), as in PHP.

## Validation

`await app.validate(req, rules, messages?, input?)` returns the cleaned fields or throws `ValidationError` (422) and audits injection attempts. GET reads the query string, everything else reads the body, unless `input` is given. Rule strings are identical to PHP (`required|email|max:254`, `nullable|date|before:today`, `sometimes`, `in:a,b`, `confirmed`, `different:field`, `raw`, `password`, `token`, `uuid`, `registration_number`, `text` for multiline). Custom messages use the PHP keys (`'consent.required'`).

## Auth, roles, rate limits

- Route middleware strings: `'auth'` (401 if no user), `'role:a,b'` (403 unless role matches), `'verified'` (403 unless `email_verified_at`), `'throttle:name,max,minutes'` (429 using the `rate_limits` table, bucket `name:<userId|ip>`).
- `requireUser(req)` returns the user row or throws 401. Role names: `patient receptionist doctor admin referrer`.
- Audit: `await app.audit.log('domain.action', req, { actor?, entity_type, entity_id, metadata })`. Failures are swallowed and logged.
- Sessions: `req.session.get/set/remove/regenerate/destroy`, stored in `http_sessions` (hashed id). Cookie `dc_session`, flags from `SESSION_SECURE/SAMESITE/DOMAIN`. Remember-me cookie `dc_remember`, tokens in `remember_tokens` (selector.validator, rotated, theft detection).
- CSRF: header `X-CSRF-Token`, value `HMAC-SHA256(seed, CSRF_SECRET)` where the seed lives in the session (`GET /auth/csrf`). Enforced for every non-GET/HEAD/OPTIONS request.
- Passwords: argon2id, `m=65536,t=4,p=1` (`services/password-hasher.js`). Hashes are emitted in PHP's `m,t,p` parameter order so `password_verify` accepts them; PHP hashes verify in Node; `needsRehash` mirrors `password_needs_rehash`.
- Encryption: `services/encryption.js`, AES-256-GCM, 12-byte IV, 16-byte tag, envelope `dc:v<ver>:iv:tag:ciphertext` (base64), `EncryptionService.fromEnv()` reads `ENCRYPTION_KEY`, `ENCRYPTION_KEY_VERSION`, `ENCRYPTION_KEYS_PREVIOUS`. Tested against vectors generated by the PHP class.
- Mail: `app.mail.sendTemplate(to, name, template, vars, attachments)`; templates live in `services/mail/templates/index.js` (`verify-email`, `password-reset`, `password-changed` done; port `booking-confirmed`, `booking-rescheduled`, `booking-cancelled`, `critical-alert` from `backend/templates/emails`). `MAIL_DRIVER=log` appends to `api/storage/logs/mail.log`, `smtp` uses nodemailer.

## Database

- `app.db` (`PgDb`): `query(sql, params)`, `all`, `one`, `value`, `execute` (row count), `tx(async (tx) => ...)`. SQL uses positional `$1` params (port PHP `:name` params in order).
- Models extend `Model` (`static table`, `static fillable`); inside a transaction use `model.using(tx)`.
- Type parsing differs from raw `pg` on purpose to match PDO: `bigint` -> number, `timestamptz`/`timestamp`/`date` stay strings. Format timestamps for responses with `toIso(value, config.timezone)` (PHP `Model::iso`, `Y-m-d\TH:i:sP`). Session time zone is `APP_TIMEZONE` (default `Asia/Kolkata`), as in PHP. `sqlTimestamp`, `zonedDate`, `humanTimestamp` in `core/time.js` replace PHP `date()`.
- Never interpolate user input into SQL. Dynamic column names must come from an allow-list.

## Testing

- `test/support/harness.js`: `makeApp({ db, env })` builds the full kernel with in-memory sessions, `InMemoryAuditLogger` and `InMemoryMailer`; `FakeDb.on(needle, rowsOrFn)` answers queries whose SQL contains `needle` (latest registration wins; `db.ran(needle)` lists executed statements); `Client` keeps cookies, fetches CSRF tokens and calls `kernel.handle` directly (no sockets). See `test/auth.test.js`.
- PHP tests use a fake PDO the same way, so no live DB is needed. Mirror `backend/tests/Unit/*Test.php` for your module as `test/<module>.test.js`. Cross-check anything byte-sensitive against PHP (`php -r`) when `php` exists, and skip otherwise.
- `test/live.test.js` is read-only and only runs with `LIVE_DB_TESTS=1`.

## Known, intentional differences from PHP

- Sessions are rows in `http_sessions` instead of files; session ids are 48 hex chars; a session cookie is only issued when a session is first written (PHP issues one on every first request). No `Expires`/`Pragma` cache headers from PHP's session layer.
- Empty PHP arrays encode as `[]`; JS empty objects encode as `{}`. Avoid returning empty associative maps where the frontend expects a list.
- Floats such as `1.0` serialise as `1` (JSON.stringify).
- Email local-part check approximates PHP `FILTER_VALIDATE_EMAIL` (dot-atom only, no quoted strings or comments).

## Controller checklist

Pick a `todo` row, set it to `in progress (name)` in your first commit, `done` in your last. Each row owns exactly one `src/modules/<module>/` folder.

| PHP controller | Node module | Routes (under `/api/v1`) | Status |
|---|---|---|---|
| HealthController | `health` | GET /health | done |
| AuthController | `auth` | GET /auth/csrf; POST /auth/register, /login, /logout; GET,PATCH /auth/me; DELETE /auth/sessions | done |
| PasswordController | `auth` | POST /auth/password/forgot, /reset; PUT /auth/password | done |
| EmailVerificationController | `auth` | POST /auth/email/verify, /resend | done |
| PublicController | `public` | GET /public/site, /doctor, /branches, /scan-categories, /scan-types, /scan-types/{ref}, /faqs, /reviews | todo |
| BookingController | `booking` | GET /booking/availability, /days, /next-available; GET /scan-types/{id:uuid}/checklist | todo |
| AppointmentController | `appointments` | GET,POST /appointments; GET /{id}, /{id}/ics; PATCH /{id}/reschedule, /cancel, /status | todo |
| PatientController | `patients` | GET /patients/lookup | todo |
| AlertController | `alerts` | POST /reports/{id}/critical; GET /alerts, /alerts/mine, /alerts/{id}/events; POST /alerts/{id}/acknowledge; PATCH /alerts/{id}/resolve | todo |
| QueueController | `queue` | GET /doctor/queue | todo |
| ReportController | `reports` | GET,POST /reports; GET,PATCH,DELETE /reports/{id}; GET /reports/{id}/download | todo |
| ReferralController | `referrals` | GET,POST /referrals; GET,PATCH /referrals/{id} | todo |
| DashboardController | `dashboards` | GET /dashboards/patient, /doctor, /receptionist, /admin, /referrer | todo |
| ReviewController | `reviews` | GET /reviews/mine; POST /reviews | todo |
| Admin\DoctorPhotoController | `doctor-photo` | GET /public/doctor/photo; POST,DELETE /admin/doctor/photo | todo |
| Admin\StatsController | `admin-stats` | GET /admin/stats | todo |
| Admin\AuditLogController | `admin-audit-log` | GET /admin/audit-log | todo |
| Admin\UserAdminController | `admin-users` | GET,POST /admin/users; PATCH /admin/users/{id}; POST /admin/users/{id}/password-reset | todo |
| Admin\BranchAdminController | `admin-branches` | GET,POST /admin/branches; PUT,PATCH,DELETE /admin/branches/{id} | todo |
| Admin\CatalogAdminController | `admin-catalog` | CRUD /admin/scan-categories, /admin/scan-types, /admin/checklist-items | todo |
| Admin\SlotAdminController | `admin-slots` | GET /admin/slots; POST /admin/slots/generate; PATCH,DELETE /admin/slots/{id} | todo |
| Admin\SettingsAdminController | `admin-settings` | GET,PATCH /admin/settings | todo |
| Admin\FaqAdminController | `admin-faqs` | GET,POST /admin/faqs; PUT,PATCH,DELETE /admin/faqs/{id} | todo |
| Admin\ReviewAdminController | `admin-reviews` | GET,POST /admin/reviews; PUT /admin/reviews/{id}; PATCH /admin/reviews/{id} (moderate) | todo |

Admin modules use `group('/admin', ['auth', 'role:admin'], [...])`; keep the exact middleware lists, including per-route `throttle:` entries, from `backend/routes/api.php`.

Shared PHP code still to port (create as needed, in new files): `Services/Booking/*`, `Services/Alerts/*` (+ `StubSmsGateway`), `Services/Reports/*`, `Services/Storage/*` (local and Supabase), `Services/Admin/*`, `Services/PublicContentPresenter`, `Services/ReviewPolicy`, remaining `Models/*`, remaining mail templates, and `backend/bin/*` scripts if they should move (migrate, seed, rotate-encryption, generate-slots).
