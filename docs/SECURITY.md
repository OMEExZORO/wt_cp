# Security

Each control, how it works and the files that implement it. Paths are relative to the repository root. The request pipeline order is defined in `backend/config/container.php` and `backend/src/Core/Kernel.php`.

## Data access

### Prepared statements only
All SQL goes through PDO with bound parameters. Models never concatenate user input; the only interpolated pieces are whitelisted column names and placeholder lists generated from counts. The `Model` base class rejects column names that do not match a strict pattern.
Files: `backend/src/Core/Database.php`, `backend/src/Models/Model.php`, every class in `backend/src/Models/`.
Note: the runtime uses the Supabase transaction pooler with emulated prepares (`PDO::ATTR_EMULATE_PREPARES`), which still binds and quotes parameters through the PDO driver.

### Row Level Security lockdown
Row Level Security is enabled on every table with no policies. The `anon` and `authenticated` Supabase roles have all table and sequence grants revoked, so the Supabase REST API exposes nothing. Only the server-side `diagnocare_app` role (BYPASSRLS) can read or write.
Files: each migration enables RLS next to its `CREATE TABLE` (`database/migrations/001_foundation.sql` to `015_alert_workflow.sql`); revocations in `database/migrations/010_lock_down_public_roles.sql`.

### Immutable alert_events
`alert_events` rejects UPDATE, DELETE and TRUNCATE through triggers calling `reject_modification()`; foreign keys into it use `ON DELETE RESTRICT`, so users are deactivated rather than deleted.
Files: `database/migrations/007_alerts.sql`, `backend/src/Models/AlertEvent.php` (insert only), `services/alerts/src/jobs/escalation.js` (appends events).

## Input and output

### Validator and Sanitizer pipeline
Every request field is declared in a rule set. `RequestValidator` runs `Validator`, which drops undeclared input, trims, enforces type, format and length (255 by default) and runs `Sanitizer::detectThreat` for SQL meta-patterns, HTML and script payloads and encoding tricks. Suspicious input is rejected with 422 (never silently stripped) and logged as `security.sqli_attempt` or `security.xss_attempt` with a 200 character sample. Passwords and tokens are not cleaned, only hashed or compared.
Files: `backend/src/Validation/Validator.php`, `Sanitizer.php`, `RequestValidator.php`. Tests: `backend/tests/Unit/ValidatorTest.php`, `SanitizerTest.php`.

### Client-side validation
The same rules run in the browser for fast feedback; the server stays the authority.
Files: `frontend/src/lib/validation.ts`, `frontend/src/lib/adminValidation.ts`, `frontend/src/hooks/useForm.ts`, `frontend/src/components/form/`.

### Output escaping
PHP: `Sanitizer::escape` (`htmlspecialchars`) is used for email templates in `backend/src/Services/Mail/MailService.php`. API responses are JSON. React escapes text by default and `dangerouslySetInnerHTML` is not used anywhere in `frontend/src`.

## Authentication and sessions

### Argon2id passwords
Passwords are hashed with `password_hash(..., PASSWORD_ARGON2ID)` and verified with `password_verify`; `password_needs_rehash` upgrades hashes at login. A dummy hash is verified for unknown emails to keep timing uniform. Password strength rules are in `Validator::passwordProblem`.
Files: `backend/src/Services/AuthService.php`, `PasswordService.php`, `RegistrationService.php`, `backend/src/Controllers/Admin/UserAdminController.php`.

### Session cookie flags
Cookie `dc_session`: `HttpOnly` always; `SameSite=None` and `Secure` in production, `Lax` without `Secure` in development; `session.use_strict_mode` on. Settings come from `SESSION_SAMESITE`, `SESSION_SECURE`, `SESSION_DOMAIN`.
Files: `backend/src/Core/Session.php`, `backend/src/Core/Cookie.php`, `backend/config/app.php` (`session` block).

### Idle timeout and absolute lifetime
Sessions end after `SESSION_IDLE_MINUTES` (30) of inactivity and `SESSION_ABSOLUTE_HOURS` (12) overall; a request also invalidates the session if the user is deactivated, the role changed, or the password changed after login.
Files: `backend/src/Core/Session.php` (`enforceLifetime`), `backend/src/Services/AuthService.php` (`sessionStillValid`), `backend/src/Middleware/StartSessionMiddleware.php`, `AuthenticateMiddleware.php`.

### Session regeneration
The session id is regenerated on login, on logout and when a remember-me cookie restores a session.
Files: `Session::regenerate`, called from `AuthService::login`, `startSession` and `logout`.

### Remember-me selector and validator
The cookie `dc_remember` holds `selector.validator`. The database stores the selector and a SHA-256 hash of the validator. The validator is rotated on each use (the previous one is accepted for 60 seconds to tolerate parallel requests); any other mismatch deletes all of the user's tokens as a theft signal. Password change and "sign out everywhere" revoke all tokens.
Files: `backend/src/Services/RememberMeService.php`, `backend/src/Models/RememberToken.php`, table `remember_tokens` in `database/migrations/002_users_and_auth.sql`.

### Rate limiting and lockout
- Login: 5 failed passwords lock an account for 15 minutes (429 with `Retry-After`); unknown emails are tracked in `login_attempts` so behaviour is the same; per-IP failure ceiling; the generic message "Incorrect email or password." never reveals which part was wrong.
- Route throttles use the `throttle:name,max,minutes` middleware, a fixed window kept in the `rate_limits` table with an atomic upsert (no Redis needed). Applied to register, login, password flows, verification, booking, report upload and download, alerts, admin password reset and slot generation (see `backend/routes/api.php`).
Files: `backend/src/Services/AuthService.php`, `backend/src/Models/LoginAttempt.php`, `backend/src/Services/RateLimiter.php`, `backend/src/Models/RateLimit.php`, `backend/src/Middleware/RateLimitMiddleware.php`, `database/migrations/012_auth_core.sql`.

### Reset and verification tokens
Random tokens are emailed once and stored only as hashes, with expiry (reset 60 minutes, verification 48 hours). Reset requests always return the same response.
Files: `backend/src/Services/PasswordService.php`, `EmailVerificationService.php`, `backend/src/Models/PasswordReset.php`, `EmailVerification.php`.

## Request integrity

### CSRF
Synchronizer token: a random seed lives in the session and the token is `HMAC-SHA256(seed, CSRF_SECRET)`. It is fetched from `GET /auth/csrf` and must arrive in `X-CSRF-Token` on every POST, PUT, PATCH and DELETE, including login and register; the compared value uses `hash_equals`. Unsafe requests with an `Origin` header outside the allowlist get 403.
Files: `backend/src/Core/Csrf.php`, `backend/src/Middleware/CsrfMiddleware.php`, `backend/src/Exceptions/CsrfException.php`, client `frontend/src/api/client.ts` (adds the header and refetches once on 419).

### CORS
An explicit allowlist from `CORS_ALLOWED_ORIGINS`; the matching origin is echoed (never `*`) with `Access-Control-Allow-Credentials: true` and `Vary: Origin`. Preflight is answered before authentication.
Files: `backend/src/Middleware/CorsMiddleware.php`, `backend/config/app.php` (`cors`).

### Security headers
API responses carry `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cache-Control: no-store` by default, and `Strict-Transport-Security` in production; `X-Powered-By` is removed. The alerts service uses Helmet with a strict CSP. The static frontend sets its own headers at the host.
Files: `backend/src/Middleware/SecurityHeadersMiddleware.php`, `services/alerts/src/app.js`, `frontend/vercel.json`, `frontend/public/_headers`, `backend/Dockerfile` (`expose_php = Off`, `ServerTokens Prod`).

### Generic errors
Production responses never include stack traces or SQL. Unexpected errors are logged server-side and returned as `{ "data": null, "error": { "code": "SERVER_ERROR", "message": "Something went wrong." } }`.
Files: `backend/src/Core/ErrorHandler.php`, `backend/src/Middleware/HandleErrorsMiddleware.php`, `backend/src/Exceptions/`.

## Authorization

### RBAC
Roles: patient, receptionist, doctor, admin, referrer. Every route declares `auth` and `role:...` middleware in `backend/routes/api.php`; the whole `/admin` group is admin only. Denials are written to the audit log as `security.forbidden`. The frontend mirrors this with `ProtectedRoute` for navigation only; the API is the enforcement point.
Files: `backend/src/Middleware/RequireAuthMiddleware.php`, `RoleMiddleware.php`, `VerifiedEmailMiddleware.php`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/lib/roles.ts`. Test: `backend/tests/Unit/RoleMiddlewareTest.php`, `AdminAccessTest.php`.

### Ownership checks and IDOR
Primary keys are UUIDs. Controllers load the record and then check the actor's relationship to it (patient owns the appointment or report, referrer is linked through the referral, staff by role). Records that the actor may not see return 404, the same as a missing id, so existence is not revealed. Report denials are also recorded in `report_access_log` and `audit_log`.
Files: `backend/src/Services/Reports/ReportAccessPolicy.php`, `backend/src/Controllers/AppointmentController.php`, `ReferralController.php`, `AlertController.php`, `backend/src/Services/Alerts/AlertWorkflow.php` (`mayAcknowledge`), `backend/src/Services/ReviewPolicy.php`. Tests: `ReportAccessPolicyTest.php`, `AlertWorkflowTest.php`, `ReviewPolicyTest.php`.

## Data protection

### AES-256-GCM for reports and notes
Report files, report notes and impressions, referral notes and optional alert notes are encrypted with AES-256-GCM through `openssl_encrypt`, with a fresh random 12 byte IV per value and a 16 byte tag. Files store IV, tag and `key_version` in the `reports` row; text columns hold `dc:v<version>:<iv>:<tag>:<ciphertext>`. Downloads verify a SHA-256 of the plaintext. Alerts, emails and SMS never carry clinical findings.
Files: `backend/src/Services/EncryptionService.php`, `backend/src/Services/Reports/ReportService.php`, `backend/src/Services/Alerts/EncryptedNoteProtector.php`. Test: `backend/tests/Unit/EncryptionServiceTest.php`.

### Key rotation
`ENCRYPTION_KEY` is the active key at `ENCRYPTION_KEY_VERSION`; older keys stay readable through `ENCRYPTION_KEYS_PREVIOUS` (`1=base64:...`). `backend/bin/rotate-encryption.php` previews and, with `--apply`, re-encrypts files and text. Procedure in `README.md`.

### Private storage
Reports are encrypted before upload, stored under random object names (`reports/YYYY/MM/<32 hex>.bin`) in a private Supabase bucket (or `backend/storage/reports` locally, outside the web root). Downloads stream through the API with `Content-Disposition: attachment`, `nosniff` and `no-store`.
Files: `backend/src/Services/Storage/`, `backend/bin/storage-setup.php`.

### Upload hardening
Real MIME type via `finfo`, allowlist PDF, JPEG and PNG, extension must match the MIME, double extensions such as `.php.pdf` rejected, 10 MiB cap (413), metadata validated before the file is read, nothing stored on failure, random stored name, never executable. The doctor photo adds image dimension limits and a 2 MB cap and is stored outside `public/`.
Files: `backend/src/Services/Reports/UploadedFileValidator.php`, `backend/src/Services/Admin/ImageUploadStore.php`, `backend/src/Controllers/ReportController.php`. Test: `backend/tests/Unit/ReportUploadTest.php`.

## Accountability

### Audit log
Security-relevant events and every admin write are recorded in `audit_log` (actor, role, IP, user agent, entity, sample): logins, lockouts, forbidden access, injection attempts, report upload, download, delete, alert actions, `admin.*` changes. Report views and downloads also go to `report_access_log`. Admins read it in the audit log page.
Files: `backend/src/Services/AuditLogger.php`, `DatabaseAuditLogger.php`, `backend/src/Models/AuditLogRepository.php`, `ReportAccessLog.php`, `backend/src/Controllers/Admin/AuditLogController.php`, `frontend/src/pages/admin/AuditLogPage.tsx`, `database/migrations/009_audit.sql`. The alerts service keeps a rotating file log: `services/alerts/src/lib/rotatingLog.js`.

### Service-to-service access
The alerts service accepts management calls only with `ALERTS_SERVICE_TOKEN` (`services/alerts/src/http/auth.js`). The worker reaches the database directly with its own connection string.

## Secrets handling

- `.env` and `.env.*` are git-ignored; only `.env.example` with empty values is committed.
- `APP_KEY`, `ENCRYPTION_KEY`, `CSRF_SECRET`, database and SMTP credentials and `SUPABASE_SERVICE_KEY` are hosting secrets. `render.yaml` lists them with `sync: false` so values are entered in the dashboard, never committed.
- The Supabase service key and database password are used only by the PHP API and Node worker, never by the browser. The frontend receives only `VITE_API_BASE_URL`.
- Dev logins exist only through `backend/bin/seed.php dev`, which refuses to run when `APP_ENV=production`.
- Rotate any access token used during setup (`SUPABASE_ACCESS_TOKEN`) after go-live.

## Known limits

- PHP file sessions are lost when the API container restarts or if more than one instance runs; remember-me restores sessions after a restart. A database session handler is the next step for multiple instances.
- SMS is a documented stub; email is the working channel.
- The in-app alert banner is polled every 60 seconds, not pushed.
