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

## Phase 4 (booking) - COMPLETE

Backend was finished earlier; this step added the frontend. No backend behaviour changed.

### Endpoints used by the UI (all under `/api/v1`, session auth)

| Method | Path | Used by |
|---|---|---|
| GET | `/booking/days` | day chips in the slot picker (next 14 days, remaining places) |
| GET | `/booking/availability` | slot list, remaining capacity, `suggestion` when the branch is full |
| GET | `/booking/next-available` | typed in `api/bookings.ts` for callers that need the earliest slot elsewhere |
| GET | `/scan-types/{id}/checklist` | checklist step and preparation text |
| POST | `/appointments` | wizard confirm; 422 field errors (`answers.<itemId>` mapped to the checklist), 409 `reason: SLOT_FULL` with `suggestion` |
| GET | `/appointments?scope=upcoming\|past` | patient dashboard |
| GET | `/appointments?date=&branch_id=&per_page=` | reception dashboard |
| GET | `/appointments/{id}` | confirmation and detail page |
| GET | `/appointments/{id}/ics` | "Download .ics file" link |
| PATCH | `/appointments/{id}/reschedule`, `/cancel` | dialogs |
| PATCH | `/appointments/{id}/status` | reception check-in, complete, no-show, urgency |

### Frontend

- `api/client.ts`: `ApiError.extra` carries extra error-envelope keys (`reason`, `suggestion`). `api/bookings.ts` holds every typed call; `types/booking.ts` the response types; `lib/booking.ts` date/time formatting, checklist validation (mirrors server rules) and `describeBookingError`.
- Wizard `/portal/patient/book` (`features/booking/BookingWizard.tsx`): branch, searchable scan type (online-bookable only), date and slot (`SlotPicker`), checklist with one control per answer type plus preparation tips, review with DPDP-style consent. Draft and step live in the `booking` Redux slice; slot object and checklist data are local state lifted into the wizard. Focus moves to the step heading on each step change. Next and Book stay disabled until the step is valid.
- Branch full: `SuggestionBanner` shows the earliest slot at the other branch with a one-click switch, both from the availability response and from a 409 at booking time.
- Confirmation and detail page `/portal/patient/appointments/:id`: details, preparation, `.ics` download, Google Calendar link, cancel and reschedule.
- Patient dashboard: upcoming and past appointments; `Dialog` (focus trap, Escape, focus return) hosts the cancel and reschedule flows; reschedule reuses `SlotPicker`.
- Reception dashboard: date and branch filter, check in / complete / no-show (no-show asks for confirmation), urgency select, checklist attention flags.
- Styles in `src/styles/booking.css`. Removed `BookingPlaceholder`.
- Tests: Vitest 57 tests in 7 files (8 new in `features/booking/booking.test.tsx`: Book disabled until valid, step navigation and focus, branch-full suggestion and switch, 409 suggestion, cancel dialog flow, XSS in cancel reason, reception check-in and urgency, refused status change). PHPUnit 199 tests, 454 assertions.
- Verified with curl through the Vite proxy: availability, days, checklist, create (including 422 field envelope), list, ics, reschedule, cancel as patient; list, urgency, check-in, complete as reception. Test bookings were deleted and slot counts restored.

### Notes for Phase 5

- `Dialog` and `StatusBadge` are reusable. Reports will need the appointment id and `patient.id` from `Appointment`; the doctor dashboard can reuse `bookingsApi.listForStaff` (it already returns `urgency`, `needs_attention`, `attention`) for the priority reading queue.
- `ApiError.extra` is the place to read any extra envelope keys.
- Reminder emails are not sent by the frontend; the Node service or a scheduled job still owns that.
## Phase 6 (critical alerts and priority reading queue) - implemented

- Migration `015_alert_workflow.sql`: adds `phone_contacted` to the `alert_events` event type CHECK, `critical_alerts.resolution_note`, and two partial indexes. The creation event is the existing `raised` type (not `created`).
- Endpoints: `POST /reports/{id}/critical` (doctor, admin), `GET /alerts/mine` (patient, referrer), `POST /alerts/{id}/acknowledge` (patient or the linked referrer; anyone else gets 404), `GET /alerts` (staff; filters `status`, `flagged`, `q`, `page`; red-flagged unresolved rows first), `GET /alerts/{id}/events` (staff audit trail), `PATCH /alerts/{id}/resolve` (receptionist, admin; note required; writes `phone_contacted` then `resolved`), `GET /doctor/queue` (doctor, admin; completed appointments with no final report, sorted Urgent > Priority > Routine then longest wait, with `waiting_minutes` and `wait_level`, plus `recent_reports` for the Flag critical action).
- Urgency changes reuse the existing `PATCH /appointments/{id}/status` with an `urgency` field; no new endpoint.
- Code: `Services/Alerts/` (`AlertService`, `AlertWorkflow` pure transitions and ownership policy, `ReadingQueue` pure sort, `AlertPresenter`, `SmsGateway` + `StubSmsGateway`, `NoteProtector` + `UnavailableNoteProtector`), models `CriticalAlert`, `AlertEvent`, `ReadingQueueQuery`, controllers `AlertController`, `QueueController`, template `critical-alert.php` (never contains the finding).
- Frontend: `features/alerts` (slice with `fetchMyAlerts` polling every 60 s and `acknowledgeAlert`, `AlertBanners` with `role="alert"` mounted in `PortalLayout`, `ReadingQueueTable`, `StaffAlertsBoard`), `components/ConfirmDialog` (focus trap, Escape, no `window.confirm`), `DoctorDashboard`, `ReceptionDashboard`, `styles/alerts.css`.
- Verified for real with `ALERT_ESCALATION_MINUTES=1`: doctor flagged a report (events `raised`, `notified` email x2, `sms_stub`, `in_app`; two mails in `mail.log`), worker run 1 produced `resent` x2 and `escalated`, run 2 produced `staff_flagged` (red flag visible to reception), reception resolved with a note (`phone_contacted`, `resolved`); a second alert was acknowledged by the patient (unlinked referrer 404, reception 403, repeat 409).
- Tests: PHPUnit 225 passing (queue sort, alert transitions, acknowledge ownership); Vitest 57 passing; `npm run build` and `services/alerts` `npm test` (17) pass.
- Dev data left on the shared Supabase DB (the immutability trigger and RESTRICT FKs prevent deleting it): appointments `DEVP6-A1..A3`, referral `DEVP6-REF`, reports with storage path `devp6/*`, two critical alerts and their events. All are labelled DEVP6.
- Merge notes: bind `NoteProtector` in `config/container.php` to an adapter over the Phase 5 `EncryptionService` (currently `UnavailableNoteProtector`, so the doctor's clinical note is dropped and the response says `note_stored: false`; the alert text itself is generic and non-clinical). Reports are flagged by ID only; nothing here uploads reports.
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
## Phase 7 (admin panel and reviews) - implemented

- No migration was needed; the schema from 004, 005, 008 and 009 already covers everything (016 unused).
- Admin API (all `auth` + `role:admin`, under `/api/v1/admin`, every write audited as `admin.*`): `GET /stats`, `GET /audit-log` (filters action prefix, actor_role, actor_user_id, entity_type, from, to; paged), users (`GET`, `POST` staff, `PATCH /{id}`, `POST /{id}/password-reset`), branches, scan-categories, scan-types, checklist-items, faqs (`GET`, `POST`, `PUT`/`PATCH /{id}`, `DELETE /{id}`), slots (`GET`, `PATCH /{id}` capacity and `is_blocked`, `DELETE /{id}`, `POST /generate`), settings (`GET`, `PATCH` with `{settings:{key:value}}`), `POST`/`DELETE /doctor/photo`, reviews (`GET`, `PATCH /{id}` approve, reject or reset).
- Public: `GET /public/doctor/photo`. Patient: `POST /reviews`, `GET /reviews/mine` (own reviews plus eligible completed visits).
- Paged lists return `{<key>: [...], pagination}` in `data` and the same object in `meta`.
- Code: `Controllers/Admin/*`, `Controllers/ReviewController`, `Models/AdminRepository`, `AuditLogRepository`, `StatsRepository`, `ReviewRepository`, `Services/ReviewPolicy`, `Services/Admin/SettingsValidator`, `Services/Admin/ImageUploadStore`.
- Frontend: `/portal/admin/*` (lazy, nested under `pages/admin/AdminLayout`), reusable `components/admin/DataTable`, `EntityForm`, `CrudPage`, `Modal`, `ConfirmDialog`, `Pagination`, `BarChart`, `SettingsForm`; patient page `/portal/patient/reviews`.
- Verified against Supabase with curl on port 8017: CRUD for FAQ, branch (edit and revert, create and delete), scan type, checklist item, slot capacity, block, bulk generate and delete, settings update and revert, doctor photo upload and delete, user create, role change, deactivate and reset; stats; audit log filters; patient, doctor, reception and referrer get 403 and guests 401 on admin routes; review submit, moderation and public visibility; demo reviews hidden with `APP_ENV=production`. All test rows were removed.
- Tests: PHPUnit 285 tests, 704 assertions; Vitest 118 tests in 8 files; `npm run build` passes.

## Phase 8C: security, accessibility and reception gaps

- Security audit found no string-built SQL, no unsafe HTML sinks, no code comments and no tracked secrets; every route has auth and role middleware and ownership checks. Added `GET /api/v1/patients/lookup` (receptionist, admin; validated, throttled, audited) and a `patient.created_walk_in` audit entry.
- Lighthouse (mobile, vite preview): Home 63/96/96/100, Services 69/98/96/100, Login 72/100/96/63 before; Home 93/100/100/100, Services 95/100/100/100, Login 90/100/100/100 after (performance/accessibility/best-practices/SEO).
- Reception UI: reschedule and cancel on each reception row, and `/portal/reception/walk-in` for booking on behalf of a new or existing patient.
- Tests: PHPUnit 369 tests, 889 assertions; Vitest 157 tests in 14 files; `npm run build` passes.
