# DiagnoCare API (Node.js)

The production REST API. Node 22, ES modules, Express 5 as the HTTP server and `pg` for PostgreSQL. It has the same routes under `/api/v1`, JSON envelope, status and error codes, cookies, CSRF scheme, validation messages and database tables as the PHP reference API in `backend/`. Render builds it from `api/Dockerfile`.

## Run and test

```bash
cd api
npm install
npm start                  # PORT (default 8000); loads api/.env, backend/.env, then ../.env without overriding real environment variables
npm run dev                # node --watch
npm test                   # node --test, no database needed
LIVE_DB_TESTS=1 npm test   # adds read-only checks against DATABASE_URL or DB_*
```

From the repository root, `npm run dev:api` starts it and `npm run test:api` runs the tests.

Environment variable names are the same as in `.env.example` and `render.yaml`. The API reads `APP_ENV`, `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_SECRET`, `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`, `SESSION_*`, `REMEMBER_DAYS`, `LOGIN_*`, `MAIL_*`, `SMTP_*`, `ENCRYPTION_KEY`, `ENCRYPTION_KEY_VERSION`, `ENCRYPTION_KEYS_PREVIOUS`, `STORAGE_*`, `SUPABASE_*`, `TRUST_PROXY` and `APP_TIMEZONE`. These are specific to this API: `PORT`, `SESSION_STORE` (`database` by default, `memory` for local runs), `LOG_PATH`, `MAX_BODY_BYTES` and `DB_POOL_MAX`.

Sessions need the `http_sessions` table from `database/migrations/020_http_sessions.sql`, which `npm run migrate` applies from the repository root. The PHP API keeps sessions in files, so a session cookie from one API is not valid on the other.

## Layout

```
src/server.js            process entry (environment, listen, graceful shutdown)
src/app.js               createKernel(options) / createApp(options), used by the tests too
src/container.js         wiring: models, auth services, mail, limiter, validator
src/routes.js            the list of modules; buildRoutes() prefixes /api/v1
src/core/                config, env, database (Db, PgDb), router, pipeline, kernel, request, response,
                         errors, error-handler, session, cookie, csrf, logger, time, http
src/middleware/          cors, security-headers, handle-errors, match-route, start-session, authenticate,
                         csrf, require-auth (auth), role, verified-email (verified), rate-limit (throttle)
src/validation/          sanitizer, validator, request-validator
src/models/              one class per table (Model base: find, create, update, delete, using(tx))
src/services/            auth, password hashing, encryption, mail, limiter, audit, booking, reports, alerts, storage
src/modules/<name>/      index.js exports `routes` (and optionally `register(app)`), plus the controllers
test/                    node:test suites; test/support/harness.js has FakeDb, makeApp and Client
```

Request pipeline: `cors -> securityHeaders -> handleErrors -> matchRoute -> startSession -> authenticate -> csrf -> route middleware -> handler`. A foreign origin on an unsafe method is rejected by `cors` before `handleErrors`, so that 403 carries no security headers, the same as in the PHP version.

## Modules

| Module | Routes (under `/api/v1`) |
|---|---|
| `health` | GET /health |
| `public` | GET /public/site, /doctor, /branches, /scan-categories, /scan-types, /scan-types/{ref}, /faqs, /reviews |
| `auth` | GET /auth/csrf; POST /auth/register, /login, /logout; GET and PATCH /auth/me; DELETE /auth/sessions; POST /auth/password/forgot, /reset; PUT /auth/password; POST /auth/email/verify, /resend |
| `booking` | GET /booking/availability, /days, /next-available; GET /scan-types/{id}/checklist |
| `appointments` | GET and POST /appointments; GET /{id}, /{id}/ics; PATCH /{id}/reschedule, /cancel, /status |
| `patients` | GET /patients/lookup |
| `alerts` | POST /reports/{id}/critical; GET /alerts, /alerts/mine, /alerts/{id}/events; POST /alerts/{id}/acknowledge; PATCH /alerts/{id}/resolve |
| `queue` | GET /doctor/queue |
| `reports` | GET and POST /reports; GET, PATCH and DELETE /reports/{id}; GET /reports/{id}/download |
| `referrals` | GET and POST /referrals; GET and PATCH /referrals/{id} |
| `dashboards` | GET /dashboards/patient, /doctor, /receptionist, /admin, /referrer |
| `reviews` | GET /reviews/mine; POST /reviews |
| `doctor-photo` | GET /public/doctor/photo; POST and DELETE /admin/doctor/photo |
| `admin-*` (9 modules) | stats, audit log, users, branches, catalog (categories, scan types, checklist items), slots, settings, FAQs, reviews, all under `/admin` and admin only |

The full list with roles and throttles is in [docs/API.md](../docs/API.md).

## Adding a module

1. Create `src/modules/<name>/index.js` and add it to the list in `src/routes.js`. Models go in `src/models/` and shared services in `src/services/`.
2. Define routes declaratively. Paths are relative to `/api/v1`:

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

   Route helpers are `get`, `post`, `put`, `patch`, `del` and `group` (groups nest and arrays are flattened). Parameter types are `{id:uuid}`, `{x:int}`, `{x:slug}` and bare `{x}`. The first matching route wins. Group middleware and route middleware are concatenated in order.
3. `register(app)` runs once at boot before the routes are compiled. Attach models to `app.models` and services to `app.services`.
4. A handler is `async (req, app) => response`:

```js
import { created } from '../../core/response.js'
import { requireUser } from '../../core/http.js'

export const store = async (req, app) => {
  const user = requireUser(req)
  const data = await app.validate(req, { slot_id: 'required|uuid', notes: 'nullable|text|max:500' })
  const appointment = await app.services.booking.book(user, data, req)
  return created({ appointment })
}
```

   `req` offers `method`, `path`, `ip`, `userAgent`, `header(name)`, `query(key?)`, `body()`, `input(key)`, `all()`, `param(name)`, `cookie(name)`, `user`, `session`, `csrf` and `rawBody`. `app` carries `config`, `db`, `logger`, `audit`, `limiter`, `mail`, `models`, `services`, `cookies` and `validate`. Responses are `ok(data, status?, meta?)`, `created(data)`, `message(text, status?)`, `noContent()` and `ApiResponse.binary(buffer, status, headers)` for downloads.
5. Handlers do not use `res` directly. They return a response or throw, and the kernel renders errors.

## Errors

Errors are thrown from `src/core/errors.js` and rendered as `{"data":null,"error":{code,message,fields?}}`.

| Class | HTTP | code |
|---|---|---|
| `BadRequestError` | 400 | BAD_REQUEST |
| `AuthenticationError` | 401 | UNAUTHENTICATED |
| `AuthorizationError` | 403 | FORBIDDEN |
| `NotFoundError` | 404 | NOT_FOUND |
| `MethodNotAllowedError(allowed)` | 405 (with `Allow`) | METHOD_NOT_ALLOWED |
| `ConflictError` | 409 | CONFLICT |
| `SlotFullError(message, suggestion, slot)` | 409 | CONFLICT (with `reason`, `suggestion`) |
| `PayloadTooLargeError` | 413 | PAYLOAD_TOO_LARGE |
| `CsrfError` | 419 | CSRF_INVALID |
| `ValidationError(fields)` or `ValidationError.withField(field, message)` | 422 | VALIDATION_FAILED |
| `RateLimitError(message, retryAfterSeconds)` | 429 (with `Retry-After`) | RATE_LIMITED |
| anything else | 500 | SERVER_ERROR (adds `debug` when `APP_DEBUG` is on outside production) |

`EncryptionError` and `StorageError` are plain errors that end as 500.

## Validation

`await app.validate(req, rules, messages?, input?)` returns the cleaned fields or throws `ValidationError` (422) and audits injection attempts. GET reads the query string, everything else reads the body, unless `input` is given. Rule strings: `required|email|max:254`, `nullable|date|before:today`, `sometimes`, `in:a,b`, `confirmed`, `different:field`, `raw`, `password`, `token`, `uuid`, `registration_number`, and `text` for multi-line input. Custom messages use keys like `'consent.required'`.

## Authentication, roles and limits

- Route middleware strings: `'auth'` (401 without a user), `'role:a,b'` (403 unless the role matches), `'verified'` (403 unless `email_verified_at` is set), `'throttle:name,max,minutes'` (429 using the `rate_limits` table, bucket `name:<userId|ip>`).
- Audit: `await app.audit.log('domain.action', req, { actor?, entity_type, entity_id, metadata })`. A failed audit write is logged and does not fail the request.
- Sessions: `req.session.get`, `set`, `remove`, `regenerate`, `destroy`, stored in `http_sessions` with a hashed id. Cookie `dc_session` with flags from `SESSION_SECURE`, `SESSION_SAMESITE` and `SESSION_DOMAIN`. Remember-me cookie `dc_remember`, tokens in `remember_tokens`.
- CSRF: header `X-CSRF-Token`, value `HMAC-SHA256(seed, CSRF_SECRET)` with the seed in the session (`GET /auth/csrf`). Required on every request except GET, HEAD and OPTIONS.
- Passwords: Argon2id (`m=65536,t=4,p=1`, `services/password-hasher.js`). Hashes use the parameter order PHP writes, so PHP's `password_verify` accepts them and the reverse.
- Encryption: `services/encryption.js`, AES-256-GCM, 12 byte IV, 16 byte tag, envelope `dc:v<version>:iv:tag:ciphertext`. `EncryptionService.fromEnv()` reads `ENCRYPTION_KEY`, `ENCRYPTION_KEY_VERSION` and `ENCRYPTION_KEYS_PREVIOUS`.
- Mail: `app.mail.sendTemplate(to, name, template, vars, attachments)`. Templates are in `services/mail/templates/`. `MAIL_DRIVER=log` appends to `api/storage/logs/mail.log` and `smtp` uses nodemailer.

## Database

- `app.db` (`PgDb`) offers `query(sql, params)`, `all`, `one`, `value`, `execute` (row count) and `tx(async (tx) => ...)`. SQL uses positional `$1` parameters.
- Models extend `Model` (`static table`, `static fillable`). Inside a transaction use `model.using(tx)`.
- Type parsing differs from raw `pg` to match the PHP API: `bigint` becomes a number, and `timestamptz`, `timestamp` and `date` stay strings. Timestamps in responses go through `toIso(value, config.timezone)`. The session time zone is `APP_TIMEZONE` (default `Asia/Kolkata`).
- User input is never interpolated into SQL. Dynamic column names come from an allow-list.

## Testing

- `test/support/harness.js`: `makeApp({ db, env })` builds the full kernel with in-memory sessions, `InMemoryAuditLogger` and `InMemoryMailer`. `FakeDb.on(needle, rowsOrFn)` answers queries whose SQL contains `needle`, and `db.ran(needle)` lists executed statements. `Client` keeps cookies, fetches CSRF tokens and calls `kernel.handle` directly, without sockets. See `test/auth.test.js`.
- Tests that depend on byte-exact output (hashes, ciphertext) run against vectors produced by the PHP implementation (`test/crypto-compat.test.js`).
- `test/live.test.js` is read-only and runs only with `LIVE_DB_TESTS=1`.

## Differences from the PHP API

- Sessions are rows in `http_sessions` instead of files. A session cookie is issued only when a session is first written, while PHP issues one on every first request.
- Empty PHP arrays encode as `[]` and empty JavaScript objects as `{}`, so handlers do not return empty maps where the frontend expects a list.
- Floats such as `1.0` serialise as `1`.
- The email local-part check approximates PHP's `FILTER_VALIDATE_EMAIL` (dot-atom only, no quoted strings or comments).
