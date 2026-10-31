# Security

Each control, how it works and the files that implement it. Paths are relative to the repository root. The deployed API is the Node.js application in `api/`. Where the PHP reference implementation in `backend/` has the same control, its file is listed as well. The request pipeline order is defined in `api/src/middleware/index.js` (`buildGlobalMiddleware`) and, for PHP, in `backend/config/container.php` and `backend/src/Core/Kernel.php`.

## Data access

### Parameterised queries only
All SQL goes through `pg` with `$1`-style parameters. Models never concatenate user input into SQL; the only interpolated pieces are column names that pass a strict `^[a-z0-9_]+$` check and placeholder lists built from a count.
Files: `api/src/core/database.js`, `api/src/models/model.js`, every class in `api/src/models/`. PHP: `backend/src/Core/Database.php`, `backend/src/Models/Model.php` (PDO prepared statements).

### Row level security lockdown
Row level security is enabled on every table with no policies. The `anon` and `authenticated` Supabase roles have all table and sequence grants revoked, so the Supabase REST API exposes nothing. Only the server-side `diagnocare_app` role (BYPASSRLS) can read or write.
Files: each migration enables RLS next to its `CREATE TABLE` (`database/migrations/001_foundation.sql` to `022_doctor_bio_and_reviews_hidden.sql`); revocations in `database/migrations/010_lock_down_public_roles.sql` and, for sessions, `020_http_sessions.sql`.

### Immutable alert_events
`alert_events` rejects UPDATE, DELETE and TRUNCATE through triggers calling `reject_modification()`. Foreign keys into it use `ON DELETE RESTRICT`, so users are deactivated rather than deleted.
Files: `database/migrations/007_alerts.sql`, `api/src/models/alert-event.js` (insert only), `services/alerts/src/jobs/escalation.js` (appends events).

## Input and output

### Validator and sanitizer
Every request field is declared in a rule set. `RequestValidator` runs `Validator`, which drops undeclared input, trims, enforces type, format and length (255 by default) and runs `detectThreat` to find SQL meta-patterns, HTML and script payloads and encoding tricks. Suspicious input is rejected with 422 (never silently stripped) and logged as `security.sqli_attempt` or `security.xss_attempt` with a 200 character sample. Passwords and tokens are not cleaned, only hashed or compared.
Files: `api/src/validation/validator.js`, `sanitizer.js`, `request-validator.js`. Tests: `api/test/validator.test.js`. PHP: `backend/src/Validation/`, tests `backend/tests/Unit/ValidatorTest.php`, `SanitizerTest.php`, `ValidationAttackMatrixTest.php`.

### Client-side validation
The same rules run in the browser for quick feedback. The server stays the authority.
Files: `frontend/src/lib/validation.ts`, `frontend/src/lib/adminValidation.ts`, `frontend/src/hooks/useForm.ts`, `frontend/src/components/form/`.

### Output escaping
API responses are JSON. Email templates escape every value (`api/src/services/mail/`; PHP `Sanitizer::escape` in `backend/src/Services/Mail/MailService.php`). React escapes text by default and `dangerouslySetInnerHTML` is not used anywhere in `frontend/src`.

## Authentication and sessions

### Argon2id passwords
Passwords are hashed with Argon2id (`argon2` package in Node, `password_hash` in PHP) and the hash is upgraded at login when its parameters are out of date. A dummy hash is verified for unknown emails so the response time does not reveal whether an account exists. Password strength rules are in the validator's `password` rule: 10 to 128 characters with upper case, lower case, a digit and a symbol.
Files: `api/src/services/password-hasher.js`, `auth-service.js`, `password-service.js`, `registration-service.js`, `api/src/modules/admin-users/users.controller.js`. PHP: `backend/src/Services/AuthService.php`, `PasswordService.php`, `RegistrationService.php`.

### Session cookie flags
Cookie `dc_session` is `HttpOnly` always. Production uses `Secure` and the `SameSite` value from `SESSION_SAMESITE` (`Lax` in `render.yaml`, because the Vercel rewrite makes the cookie first-party). Development uses `Lax` without `Secure`. The cookie has no Domain unless `SESSION_DOMAIN` is set. Session ids are 24 random bytes (48 hex characters). The database stores only their SHA-256 hash, and a cookie value that does not match that format or a stored session is ignored.
Files: `api/src/core/session.js`, `api/src/core/cookie.js`, `api/src/core/config.js` (`session` block). PHP: `backend/src/Core/Session.php`, `Cookie.php`.

### Server-side session store
Node sessions are rows in `http_sessions` (id, JSON data, expiry), so they survive restarts and work with more than one API instance. `SESSION_STORE=memory` exists for local runs and tests.
Files: `api/src/core/session.js` (`DatabaseSessionStore`), `database/migrations/020_http_sessions.sql`. PHP uses file sessions in `backend/storage/sessions`.

### Idle timeout and absolute lifetime
Sessions end after `SESSION_IDLE_MINUTES` (30) of inactivity and `SESSION_ABSOLUTE_HOURS` (12) overall. A request also invalidates the session if the user was deactivated, the role changed, or the password changed after login.
Files: `api/src/core/session.js`, `api/src/middleware/start-session.js`, `authenticate.js`, `api/src/services/auth-service.js` (`sessionStillValid`). PHP: `Session::enforceLifetime`, `StartSessionMiddleware`, `AuthenticateMiddleware`.

### Session regeneration
The session id is regenerated on login, on logout and when a remember-me cookie restores a session.
Files: `api/src/core/session.js` (`regenerate`), called from `auth-service.js`.

### Remember-me selector and validator
The cookie `dc_remember` holds `selector.validator`. The database stores the selector and a SHA-256 hash of the validator. The validator is rotated on each use, and the previous one is accepted for 60 seconds to tolerate parallel requests. Any other mismatch deletes all of the user's tokens as a theft signal. A password change and "sign out everywhere" revoke all tokens.
Files: `api/src/services/remember-me-service.js`, `api/src/models/remember-token.js`, table `remember_tokens` in `database/migrations/002_users_and_auth.sql`. PHP: `backend/src/Services/RememberMeService.php`.

### Rate limiting and lockout
- Login: 5 failed passwords lock an account for 15 minutes (429 with `Retry-After`). Unknown emails are tracked in `login_attempts`, so behaviour is the same. There is a per-IP failure ceiling. The message "Incorrect email or password." never reveals which part was wrong.
- Route throttles use the `throttle:name,max,minutes` middleware, a fixed window kept in the `rate_limits` table with an atomic upsert (no Redis needed). They are applied to register, login, password flows, verification, booking, report upload and download, alerts, admin password reset and slot generation.
Files: `api/src/services/auth-service.js`, `rate-limiter.js`, `api/src/models/login-attempt.js`, `rate-limit.js`, `api/src/middleware/rate-limit.js`, `database/migrations/012_auth_core.sql`. PHP: `backend/src/Services/RateLimiter.php`, `Middleware/RateLimitMiddleware.php`.

### Reset and verification tokens
Random tokens are emailed once and stored only as SHA-256 hashes, with an expiry (reset 60 minutes, verification 48 hours). A reset request always returns the same response.
Files: `api/src/services/password-service.js`, `email-verification-service.js`, `api/src/models/password-reset.js`, `email-verification.js`.

## Request integrity

### CSRF
Synchronizer token: a random seed lives in the session and the token is `HMAC-SHA256(seed, CSRF_SECRET)`. It is fetched from `GET /auth/csrf` and must arrive in `X-CSRF-Token` on every POST, PUT, PATCH and DELETE, including login and register. Comparison is constant time. Unsafe requests with an `Origin` header outside the allowlist get 403.
Files: `api/src/core/csrf.js`, `api/src/middleware/csrf.js`, client `frontend/src/api/client.ts` (adds the header and refetches once on 419). PHP: `backend/src/Core/Csrf.php`, `Middleware/CsrfMiddleware.php`.

### CORS
An explicit allowlist from `CORS_ALLOWED_ORIGINS`. The matching origin is echoed (never `*`) with `Access-Control-Allow-Credentials: true` and `Vary: Origin`. Preflight is answered before authentication.
Files: `api/src/middleware/cors.js`, `api/src/core/config.js` (`cors`). PHP: `backend/src/Middleware/CorsMiddleware.php`.

### Security headers
API responses carry `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cache-Control: no-store` by default and `Strict-Transport-Security` in production. `X-Powered-By` is turned off. The alerts service uses Helmet with a strict CSP. The static frontend sets its own headers at the host.
Files: `api/src/middleware/security-headers.js`, `api/src/app.js`, `services/alerts/src/app.js`, `frontend/vercel.json`, `frontend/public/_headers`. PHP: `SecurityHeadersMiddleware.php`, `backend/Dockerfile`.

### Generic errors
Production responses never include stack traces or SQL. Unexpected errors are logged on the server and returned as `{ "data": null, "error": { "code": "SERVER_ERROR", "message": "Something went wrong." } }`. Malformed JSON, oversize bodies and unknown routes use the same envelope.
Files: `api/src/core/error-handler.js`, `errors.js`, `api/src/middleware/handle-errors.js`. PHP: `backend/src/Core/ErrorHandler.php`, `backend/src/Exceptions/`.

## Authorization

### Role-based access
Roles are patient, receptionist, doctor, admin and referrer. Every route declares `auth` and `role:...` middleware in its module's `index.js`, and the whole admin area is admin only. Denials are written to the audit log as `security.forbidden`. The frontend mirrors the roles with `ProtectedRoute` for navigation only; the API is where access is enforced.
Files: `api/src/middleware/require-auth.js`, `role.js`, `verified-email.js`, `api/src/modules/*/index.js`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/lib/roles.ts`. PHP: `backend/routes/api.php`, `Middleware/RoleMiddleware.php`. Tests: `api/test/middleware.test.js`, `admin.test.js`.

### Ownership checks and IDOR
Primary keys are UUIDs. Controllers load the record and then check the actor's relationship to it: the patient owns the appointment or report, the referrer is linked through the referral, staff by role. A record the actor may not see returns 404, the same as a missing id, so its existence is not revealed. Report denials are also recorded in `report_access_log` and `audit_log`.
Files: `api/src/services/reports/report-access-policy.js`, `api/src/modules/appointments/appointments.controller.js`, `api/src/modules/referrals/referrals.controller.js`, `api/src/modules/alerts/alerts.controller.js`, `api/src/services/alerts/alert-workflow.js`, `api/src/services/review-policy.js`. Tests: `api/test/reports.test.js`, `alerts.test.js`, `reviews.test.js`.

## Data protection

### AES-256-GCM for reports and notes
Report files, report notes and impressions, referral notes and optional alert notes are encrypted with AES-256-GCM, with a fresh random 12 byte IV per value and a 16 byte tag. Files store the IV, tag and `key_version` in the `reports` row. Text columns hold `dc:v<version>:<iv>:<tag>:<ciphertext>`. Downloads verify a SHA-256 of the plaintext. Alerts, emails and SMS never carry clinical findings.
Files: `api/src/services/encryption.js`, `api/src/services/reports/report-service.js`. PHP: `backend/src/Services/EncryptionService.php`. The two implementations read each other's output, which is checked by `api/test/crypto-compat.test.js`.

### Key rotation
`ENCRYPTION_KEY` is the active key at `ENCRYPTION_KEY_VERSION`. Older keys stay readable through `ENCRYPTION_KEYS_PREVIOUS` (`1=base64:...`). `backend/bin/rotate-encryption.php` previews and, with `--apply`, re-encrypts files and text. The procedure is in `README.md`.

### Private storage
Reports are encrypted before upload and stored under random object names (`reports/YYYY/MM/<32 hex>.bin`) in a private Supabase bucket, or in `api/storage/reports` for local runs, outside any web root. Downloads stream through the API with `Content-Disposition: attachment`, `nosniff` and `no-store`.
Files: `api/src/services/storage/` (`supabase-storage.js`, `local-storage.js`), `backend/bin/storage-setup.php`. PHP: `backend/src/Services/Storage/`.

### Upload hardening
The file type is detected from the file's leading bytes, not from the name or the client's content type. Only PDF, JPEG and PNG are accepted, the extension must match the detected type, dangerous names such as `.php.pdf` are rejected, and the cap is 10 MiB (413). Metadata is validated before the file is processed, nothing is stored on failure, and the stored name is random. The doctor photo accepts JPEG, PNG and WebP, adds image dimension limits (200 to 6000 pixels) and a 2 MB cap, and is stored outside any public folder.
Files: `api/src/services/uploads.js`, `api/src/services/reports/uploaded-file-validator.js`, `api/src/services/admin/image-upload-store.js`, `api/src/modules/reports/reports.controller.js`. Tests: `api/test/reports.test.js`, `referrals-photo.test.js`. PHP: `UploadedFileValidator.php`, `ImageUploadStore.php`.

## Accountability

### Audit log
Security-relevant events and every admin write are recorded in `audit_log` (actor, role, IP, user agent, entity, sample): logins, lockouts, forbidden access, injection attempts, report upload, download and delete, alert actions and `admin.*` changes. Report views and downloads also go to `report_access_log`. Admins read the log on the audit log page.
Files: `api/src/services/audit-logger.js`, `api/src/models/audit-log-repository.js`, `report-access-log.js`, `api/src/modules/admin-audit-log/`, `frontend/src/pages/admin/AuditLogPage.tsx`, `database/migrations/009_audit.sql`. The alerts service keeps a rotating file log in `services/alerts/src/lib/rotatingLog.js`.

### Service-to-service access
The alerts service accepts management calls only with `ALERTS_SERVICE_TOKEN` (`services/alerts/src/http/auth.js`). Without a configured token those endpoints return 503. The worker connects to the database directly with its own connection string.

## Secrets handling

- `.env` and `.env.*` are git-ignored. Only `.env.example` files with empty or placeholder values are committed.
- `APP_KEY`, `ENCRYPTION_KEY`, `CSRF_SECRET`, database and SMTP credentials and `SUPABASE_SERVICE_KEY` are hosting secrets. `render.yaml` lists them with `sync: false`, so values are entered in the dashboard and never committed.
- The Supabase service key and the database password are used only by the API and the worker, never by the browser. The frontend receives no secrets.
- Development accounts exist only through `npm run seed:dev`. The script reads their shared password from `DEV_SEED_PASSWORD` and refuses to run when `APP_ENV=production`. No password is stored in the repository.
- The Postman environment ships with empty password values. Fill them in locally.

## Scope and known limits

- SMS is a stub. Email is the working channel, and it writes to a log file until SMTP credentials are set.
- The in-app alert banner is polled every 60 seconds, not pushed.
- The PHP reference API keeps sessions in files, so they are lost when its process restarts and cannot be shared between instances. The deployed Node API stores sessions in the database and does not have this limit.
- The 45-case live attack check (`backend/bin/validation-attack-check.php`) was run against the PHP API. The Node API is covered by its own validator and middleware tests and by the Postman collection, which includes script-tag and SQL payload cases.
