# Progress

## Phases

- [x] 1. Repo scaffold, tooling, DB migrations and seed, env setup, scripts
- [x] 2. PHP core: router, MVC base, Validator and Sanitizer, error handling, auth with sessions, cookies and remember-me, RBAC
- [ ] 3. Public portfolio site (all pages)
- [ ] 4. Booking system, checklists, calendar links, emails
- [ ] 5. Reports upload and download with encryption, referrer portal
- [ ] 6. Critical alerts, priority queue, Node alerts service
- [ ] 7. Admin panel, reviews with moderation
- [ ] 8. Tests, Postman, security pass, accessibility, docs, deployment configs

## Phase 1 summary

- Monorepo: `frontend` (React 18.3, TS, Vite, Router v6, Redux Toolkit, Vitest), `backend` (plain PHP 8.3, Composer PSR-4, PHPUnit 11), `services/alerts` (Express 5 + pg skeleton with `/health` and a static status page), `database`, `docs`, `postman`.
- Backend core so far: `Env` loader, `Database` (transaction pooler with emulated prepares; session pooler for migrations), `Response` JSON envelope, `AppException`, `GET /api/v1/health`.
- 11 migrations applied to Supabase: 24 tables including `schema_migrations`, `updated_at` triggers, immutable `alert_events`, RLS enabled on all tables, no grants for `anon` / `authenticated`.
- Seeds loaded: 2 branches, 9 scan categories, 56 scan types, 36 checklist items, 11 FAQs, 23 site settings; dev: 5 users (one per role), 1 patient, 1 referrer, 1152 slots; demo: 4 reviews labelled "Demo data".
- Private Storage bucket `reports` created.
- Verified: `npm run build` (frontend), Vitest 2/2, `composer install`, PHPUnit 3/3, PHP and Node health endpoints, `docker compose config`.
- Not verified: Docker image builds (Docker daemon was not running).

## Phase 2 summary

- PHP core (`backend/src/Core`): `Request`, `Response` (object), `Router` with route params, typed params, groups and middleware, 404 / 405 JSON, `Kernel`, `Pipeline`, autowiring `Container`, `Config`, native `Session` with idle and absolute timeouts, `Cookie`, `Csrf`, `ErrorHandler` (no details in production), `Logger`.
- Exceptions: `AppException` plus `ValidationException`, `AuthenticationException`, `AuthorizationException`, `NotFoundException`, `MethodNotAllowedException`, `ConflictException`, `CsrfException`, `RateLimitException`, `BadRequestException`, `PayloadTooLargeException`.
- `Validator` and `Sanitizer` with `RequestValidator` (audit logging of SQLi/XSS attempts), base `Controller::validate()`, base `Model` (PDO prepared statements).
- Middleware: CORS, security headers, error handling, route matching, session, authenticate (session or remember-me), CSRF, `auth`, `role`, `verified`, `throttle`.
- Services: `AuthService`, `RegistrationService`, `PasswordService`, `EmailVerificationService`, `RememberMeService`, `RateLimiter`, `AuditLogger` (`DatabaseAuditLogger`), `Mail\MailService` with `LogMailer` and `SmtpMailer` (PHPMailer 6), templates in `backend/templates/emails`.
- Migration `012_auth_core.sql`: `users.consent_given_at`, `users.consent_version`, `remember_tokens.previous_validator_hash`, `remember_tokens.rotated_at`, table `rate_limits`.
- Frontend: typed API client with CSRF, Redux slices `auth`, `booking`, `alerts`, React Router v6 nested routes with lazy pages, `ProtectedRoute`, `GuestRoute`, `ErrorBoundary`, `ThemeContext` (cookie), form components, `useForm`, `useApi`, `lib/validation.ts`, auth pages, portal layout, five role dashboard stubs, account page (change password, sign out everywhere). Vite proxies `/api` to the PHP server.

### Endpoints (all under `/api/v1`)

| Method | Path | Middleware |
|---|---|---|
| GET | `/health` | none |
| GET | `/auth/csrf` | none |
| POST | `/auth/register` | throttle 10/60 min |
| POST | `/auth/login` | throttle 20/10 min, plus account lockout |
| POST | `/auth/logout` | none |
| GET | `/auth/me` | auth |
| PATCH | `/auth/me` | auth |
| DELETE | `/auth/sessions` | auth |
| POST | `/auth/password/forgot` | throttle 5/15 min, plus 3 per email per hour |
| POST | `/auth/password/reset` | throttle 10/15 min |
| PUT | `/auth/password` | auth, throttle |
| POST | `/auth/email/verify` | throttle |
| POST | `/auth/email/resend` | auth, throttle 3/15 min |
| GET | `/dashboards/{patient,doctor,receptionist,admin,referrer}` | auth, role |

All POST, PUT, PATCH and DELETE need `X-CSRF-Token`.

### Verified (real runs)

- curl against `php -S` and Supabase: login, me, dashboard and logout for all five dev users; wrong role 403; CSRF missing 419; unknown route 404; wrong verb 405 with `Allow`; generic login error for bad password and unknown email; patient and referrer registration with consent; duplicate email 409; missing consent 422; email verification from `mail.log` (token single use); SQLi and XSS payloads rejected with 422 and logged as `security.sqli_attempt` / `security.xss_attempt`; PATCH profile; PUT change password (wrong current password 422); DELETE sessions; forgot and reset password from `mail.log` (reused token 422, old password rejected, new accepted); remember-me rotation, 60 s grace, theft detection revoking all tokens; lockout on the 5th failure with 429 and `Retry-After`; CORS preflight allowed for the frontend origin and refused for others; login through the Vite proxy.
- PHPUnit: 127 tests, 178 assertions, all passing (Env, Validator, Sanitizer, RBAC middleware, Router/Kernel/ErrorHandler).
- Vitest: 37 tests in 5 files, all passing. `npm run build` passes.

## Next (Phase 3)

Public portfolio site. Replace the placeholder `SiteHeader`, `SiteFooter`, `HomePage` and styles; keep the PCPNDT notice and disclaimer in the footer. Public read endpoints (branches, scan types, FAQs, public site settings, approved reviews) go in `backend/routes/api.php` without `auth`. Follow `docs/CONVENTIONS.md`.

---

## Phase 3 (public portfolio site) - implemented

- Public API (GET only, no auth) under `/api/v1/public`: `site`, `doctor`, `branches`, `scan-categories`, `scan-types` (`modality`, `q`), `scan-types/{slug|uuid}`, `faqs` (`category`, `limit`), `reviews` (approved only, `is_demo` rows excluded when `APP_ENV=production`, returns `summary.count` and `summary.average_rating`). Code: `PublicController`, models `SiteSetting`, `Branch`, `ScanCategory`, `ScanType`, `Faq`, `Review`, `Services/PublicContentPresenter`. Only `is_public` settings are returned; placeholders come back as `value: null, is_placeholder: true`. Fees and durations are never exposed.
- Frontend: Redux slice `features/public` (thunks with a duplicate-load guard), `usePublicResource` hook, pages Home, About, Services (+ scan detail), Branches, Reviews, FAQ, Contact, Book, Privacy, Terms in `src/pages` and `src/pages/public`. `/portal/patient/book` is a placeholder page until Phase 4. Styles: `src/styles/tokens.css` (all design tokens) and `src/styles/site.css`.
- SEO: `usePageMeta`, JSON-LD `MedicalBusiness` and `Physician` (`components/public/StructuredData.tsx`), `scripts/generate-seo.mjs` writes `public/robots.txt` and `public/sitemap.xml` on build (`SITE_URL` env, default `https://www.example.com`).
- Tests: PHPUnit 135 tests, 193 assertions; Vitest 49 tests in 6 files.

---

## Phase 5 (reports with encryption, referrer portal) - implemented

Migration `014_reports.sql` adds `reports.impression_encrypted`, `reports.storage_driver` and indexes.

### Endpoints (all under `/api/v1`, all need `auth` and CSRF for unsafe methods)

| Method | Path | Roles |
|---|---|---|
| GET | `/reports` (filters `q`, `status`, `patient_id`, `appointment_id`, `from`, `to`, `page`, `per_page`) | patient (own, released only), referrer (own referred patients, released only), receptionist, doctor, admin (all) |
| POST | `/reports` (multipart: `appointment_id`, `title`, `file`, optional `patient_id`, `notes`, `impression`, `status` draft or final) | doctor, receptionist, admin |
| GET | `/reports/{id}` | as list, logs `view` |
| GET | `/reports/{id}/download` | as list, streams decrypted bytes, logs `download` |
| PATCH | `/reports/{id}` (`title`, `notes`, `impression`, `status`) | doctor, receptionist, admin |
| DELETE | `/reports/{id}` | admin (soft delete plus storage delete, logs `delete`) |
| POST | `/referrals` | referrer |
| GET | `/referrals`, `/referrals/{id}` | referrer (own), staff (all) |
| PATCH | `/referrals/{id}` (`status`, `appointment_id`) | receptionist, doctor, admin |

### Code map

- `Services/EncryptionService` (AES-256-GCM, versioned keys), `Services/Storage/{StorageService,SupabaseStorage,LocalStorage}`, `Services/Reports/{ReportService,ReportAccessPolicy,UploadedFileValidator,ReportPresenter}`, `Controllers/{ReportController,ReferralController}`, `Models/{Report,ReportAccessLog,Referral}`, `bin/rotate-encryption.php`.
- Frontend: `api/{reports,referrals}.ts`, `types/{report,referral}.ts`, `lib/reportFile.ts`, `features/reports/*`, `features/referrals/*`, `pages/portal/reports/*`, `pages/portal/ReferrerDashboard.tsx`. Routes: `/portal/patient/reports`, `/portal/{doctor,reception}/reports`, `/portal/{doctor,reception}/reports/new`, `/portal/{doctor,reception}/referrals`, `/portal/referrer`.

### Verified (real runs, `php -S` on 8015 against Supabase with `STORAGE_DRIVER=supabase`)

- Doctor uploaded a PDF for the dev patient; the object in the private bucket does not start with `%PDF`, does not contain the plaintext marker, and the public URL is refused.
- Patient downloaded it; `cmp` shows the bytes identical; headers `Content-Type: application/pdf`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
- Referrer requesting an unlinked report by forged id got 404 on `GET` and `/download`; linking the appointment to the referrer's referral made it downloadable, and setting the report to draft hid it again.
- A text file named `.pdf` got 422, PNG bytes named `.pdf` got 422, an 11 MB file got 413. Patients cannot upload (403), doctors cannot delete (403), admin delete returned 204 and the object was removed.
- Referrer created a referral (notes stored encrypted); reception moved it to accepted and linked an appointment; the referrer cannot PATCH (403).
- Test uploads, the test referral and the appointment link were removed afterwards.
- PHPUnit: 251 tests, 577 assertions passing. Vitest: 61 tests in 8 files passing. `npm run build` passes.
