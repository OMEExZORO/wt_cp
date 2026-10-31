# Decisions

The main design choices and the reasons for them, grouped by topic.

## Infrastructure

| Topic | Decision | Reason |
|---|---|---|
| Repository | One repository (monorepo) on branch `main`, public on GitHub. Secrets stay in untracked `.env` files | One place for the frontend, both APIs, the worker, migrations and docs |
| Database | Supabase PostgreSQL | Hosted Postgres with a free tier and a private storage bucket |
| Database credentials | A dedicated role `diagnocare_app` with `BYPASSRLS` and `CREATE` on schema `public`, instead of the `postgres` superuser | Least privilege. The role can be rotated or revoked without touching the Supabase admin account |
| Pooler modes | The API runtime uses the transaction pooler (port 6543). Migrations and seeds use the session pooler (port 5432, `DB_MIGRATE_PORT`) | Transaction pooling does not support server-side prepared statements. DDL and advisory locks need a session |
| Row level security | Enabled on every table with no policies. `anon` and `authenticated` have no table grants | Only the server-side connection can read or write. The Supabase REST API exposes nothing |
| Storage | Private bucket `reports` (`public = false`, 15 MiB object limit), created by `backend/bin/storage-setup.php` through the Storage REST API with the service key | Files are encrypted before upload, so the limit leaves room for the 10 MiB plaintext cap plus overhead |
| Timezone | `Asia/Kolkata` for the API and database sessions. Columns are `TIMESTAMPTZ` | One-city clinic |
| Frontend | React 18.3 pinned, TypeScript 5.8, Vite 8, Vitest 5 | The course specifies React 18 |
| Root scripts | `concurrently` runs API, frontend and worker with `npm run dev` | Works without Docker |

## Two implementations of the API

| Topic | Decision | Reason |
|---|---|---|
| PHP reference API | `backend/` is plain PHP 8.3 with its own router, middleware pipeline and autowiring container. It was written first and covers syllabus Unit I | The course asks for PHP without a framework, and writing the pieces by hand keeps every concept visible |
| Node.js production API | `api/` is a port of the PHP API to Node.js 22 and Express 5. It has the same 101 routes, JSON envelope, status codes, error codes, cookies, CSRF scheme, validation messages and tables | The worker and the frontend tooling are already Node, so everything deployed runs on one language and runtime. Node also covers syllabus Unit VI for the main API |
| Express as a thin shell | Express only reads the raw body and passes the request to the application's own kernel (`api/src/core`). Routing, middleware, sessions, CSRF and validation are not Express features | Keeps the port structurally close to the PHP code and keeps the concepts visible |
| Parity | The two APIs are compared by tests: a shared Postman collection, a status and masked-body comparison of 289 requests, and cross-checks that each side can verify the other's Argon2id hashes and AES-GCM envelopes (`api/test/crypto-compat.test.js`) | A port is only useful if clients cannot tell the difference |
| Reference stays in the repo | `backend/` is not deployed but is tested (PHPUnit) and used by the migration and seed scripts | The syllabus evidence for Unit I, and a second implementation to compare against |
| Migration runner | `npm run migrate` and the seed commands still use the PHP scripts in `backend/bin` | One runner with checksums is enough, and both APIs use the same schema |
| Sessions | Node sessions are rows in `http_sessions`. PHP sessions are files | Container restarts and a second instance do not log people out on the Node API. The two cookies are not interchangeable |

## Data model

| Topic | Decision |
|---|---|
| Primary keys | UUID for entities (harder to enumerate, defence in depth against IDOR). Identity BIGINT for append-only logs |
| Enums | `TEXT` plus `CHECK` constraints rather than Postgres enum types, so migrations can extend them |
| Services | `scan_categories` (top level USG, CT, BIOPSY with child groups Obstetrics, Gynecology, General and Specialized, Prostate Imaging, USG Guided, CT Guided) and 56 `scan_types` matching the brochure. `modality` is copied onto `scan_types` for filtering |
| Slots | One row per branch, modality, date and start time, with `capacity` and `booked_count`. USG, CT and biopsy use separate equipment, so they are scheduled independently |
| Duplicate bookings | Partial unique index: one non-cancelled appointment per patient per slot |
| Checklists | Items apply to a whole modality (for example CT contrast allergy) or to one scan type (for example full bladder for pelvic USG). `attention_answers` lists the answers that flag staff review |
| Scan durations | Defaults in `scan_types.duration_minutes` are scheduling values only, are not shown as claims, and can be edited by an admin |
| Fees | `scan_types.fee_inr` exists but is empty. Fees are not shown |
| Patient gender | Optional (female, male, other, prefer not to say), for clinical context only. There is no fetal-sex field anywhere |
| Patients and users | `patients.user_id` is nullable, so reception can register walk-in patients without portal accounts |
| Alert audit trail | `alert_events` rejects UPDATE, DELETE and TRUNCATE by trigger. Foreign keys into it use `ON DELETE RESTRICT`, so users are deactivated rather than deleted |
| Token storage | Remember-me uses a selector plus a SHA-256 hash of the validator. Reset and verification tokens are stored only as hashes |
| Lockout | `users.failed_login_count` and `users.locked_until`, plus `login_attempts` for IP and email throttling |
| Unknown content | `site_settings.value = NULL` with `is_placeholder = TRUE`. The frontend shows a placeholder badge only in development builds and omits the field in production |
| Migration fix | Migration 011 replaces `checklist_items.attention_answer` with `attention_answers TEXT[]` rather than editing the already applied migration 004. Number 016 is not used |
| Emergency number | The disclaimer refers to 112, India's national emergency number |

## Development data

- Development users are on the reserved `.test` domain. They exist only through `npm run seed:dev`, which refuses to run with `APP_ENV=production` and takes the shared password from `DEV_SEED_PASSWORD`. No password is stored in the repository.
- Development slots run 08:00 to 22:00, Monday to Saturday, for 30 days, at all four branches. The clinic is closed on Sunday (client decision). The lab service runs 24 hours.
- Demo reviews are labelled "Demo data" in both name and text, flagged `is_demo = TRUE`, and removed with `npm run seed:purge-demo`.

## Authentication and sessions

| Topic | Decision | Reason |
|---|---|---|
| Sessions and cookies | Own session layer with cookie `dc_session`, idle timeout 30 minutes, absolute lifetime 12 hours | The syllabus covers PHP sessions and cookies, and the Node API keeps the same behaviour |
| Cookie flags | HttpOnly always. `SameSite` and `Secure` come from `SESSION_SAMESITE` and `SESSION_SECURE`: Lax without Secure in development, Lax with Secure in production behind the Vercel rewrite | Spec. A cross-site deployment would use `None` with `Secure` |
| Same-origin in development | Vite proxies `/api` to the API and `VITE_API_BASE_URL` is `/api/v1` | Cookies work without third-party cookie rules |
| CSRF | Synchronizer token: a random seed in the session, token = HMAC-SHA256(seed, `CSRF_SECRET`), sent in `X-CSRF-Token` on every POST, PUT, PATCH and DELETE including login and register. Not rotated at login | Covers login CSRF. The client refetches once on 419 |
| Origin check | Unsafe requests with an `Origin` header outside the allowlist get 403 | Defence in depth next to CSRF |
| Email verification | Login is allowed before verification. The portal shows a banner with a resend button. Features that need a verified email (booking) use the `verified` middleware | Patients can still reach the portal if mail is delayed |
| Duplicate registration | 409 with a field error on `email` | Usability. Enumeration is limited by the register throttle (10 per hour per IP) |
| Lockout | 5 failed passwords lock the account for 15 minutes (429 with `Retry-After`). Unknown emails are treated the same through `login_attempts`. The login route is also throttled per IP (20 per 10 minutes). The message is always "Incorrect email or password." | Uniform behaviour does not reveal which emails exist |
| Rate limiting | Table `rate_limits` with an atomic upsert fixed window, keyed by limiter name and user id or IP | Works with several processes and needs no Redis |
| Remember me | Cookie `selector.validator`. The validator is rotated on each use, the previous one is accepted for 60 seconds, and any other mismatch deletes all of the user's tokens | Rotation plus theft detection, tolerant of parallel first requests |
| Session invalidation | Each request reloads the user. The session is dropped if the user is inactive, the role changed, or `password_changed_at` is newer than the login | Password changes sign out other devices, and role changes apply immediately |
| Sign out everywhere | `DELETE /auth/sessions` revokes all remember-me tokens and ends the current session. Other live sessions end at their idle timeout | No session registry is needed |
| Consent | Stored on `users.consent_given_at` and `consent_version` (both roles) and on `patients` for patients. Current version `2026-10-v1` | DPDP-style record of when consent was given |
| Validator scope | Only declared fields are returned and undeclared input is dropped. Passwords and tokens are not cleaned or scanned. Everything else is cleaned, length capped (255 by default) and scanned for HTML and SQL patterns | Every field is checked before a write, and passwords are only hashed |
| Threat handling | Suspicious input is rejected (422), never silently stripped, and logged to `audit_log` as `security.sqli_attempt` or `security.xss_attempt` with a 200 character sample | Spec |
| Mail | `MAIL_DRIVER=log` (default) writes to a log file. `smtp` uses nodemailer in the Node API and PHPMailer in the PHP API | Works without SMTP credentials in development and in the deployed demo |
| Timestamps | JSON timestamps are ISO 8601 with offset | Safe `Date` parsing in every browser |
| Theme cookie | `theme` cookie (light or dark) set by the frontend and not read by the server | The "theme cookie" requirement. Context is used only for the theme |

## Public site and booking

- There is no contact-form table, so there is no `POST /public/contact`. The Contact page shows phone and hours and tells visitors not to send medical details by email. WhatsApp and email are hidden until the centre supplies them.
- All "Book an appointment" buttons go to `/book`, an explainer page whose button leads to `/portal/patient/book` (sign-in required, handled by `ProtectedRoute`).
- The Services list is fetched once into Redux and filtered in the browser with `useMemo`. The filter state lives in `ServicesPage` and is passed down. The scan detail page uses `useApiQuery` because only that page needs the data.
- Fonts are Fraunces (headings) and Figtree (body), loaded from Google Fonts. The light and dark theme toggle is kept, and the dark overrides are in `tokens.css`.
- The cookie consent banner records the visitor's choice in `localStorage`. No analytics cookies exist, so "Accept all" changes nothing today.
- The Privacy and Terms pages are drafts written by the team without legal review.
- The seeded FAQ "Will the centre tell me the sex of my baby?" is shown as written. The doctor decides whether it stays.
- `ApiError` keeps unknown keys of the error envelope in `extra`, so the 409 `suggestion` reaches the UI without changing the envelope.
- The booking wizard keeps its draft (ids, answers, notes, consent) and current step in the `booking` Redux slice. The selected `Slot` and the loaded checklist stay local because they are derived from the API. A reopened wizard returns to the slot step so the slot is checked against live capacity.
- The confirmation page `/portal/patient/appointments/:id` doubles as the detail page. The "booked" banner shows only when navigation state says `confirmed`.
- The `.ics` button is a plain link to the API URL, since the session cookie authorises it.
- Dialogs are custom (`role="dialog"`, `aria-modal`, focus trap, Escape, focus return) instead of `window.confirm`. Marking a no-show asks for confirmation because it cannot be undone.

## Critical alerts

- Alert creation uses the `raised` event. Migration 015 added `phone_contacted` for reception call notes.
- Alerts, emails, banners and SMS never carry clinical findings. They say a finding needs attention and ask the recipient to sign in and contact the centre. An optional doctor note is stored only through the encryption service. If no encryption service is configured the note is dropped and the API reports `note_stored: false`.
- Either the patient or the linked referrer acknowledging closes the escalation (a single `acknowledged` state, with the actor in the event). Non-owners receive 404, so the alert's existence is not revealed.
- The API sets `next_escalation_at` to now plus `ALERT_ESCALATION_MINUTES` after notifying. The worker reads the same variable, so both use one window.
- Escalation jobs run in production from a GitHub Actions workflow every 30 minutes (`npm run jobs:once`), because the Render free plan can keep only one service awake. The same code runs on a 60 second timer when the worker service is running.
- The reading queue is appointments with status `completed` and no non-draft report. Waiting time runs from `completed_at`, falling back to the slot end. A case is overdue after 30 minutes (Urgent), 2 hours (Priority) or 6 hours (Routine), with a warning at half that.
- The in-app banner is polled every 60 seconds. There is no websocket layer.

## Reports and referrals

| Decision | Choice | Reason |
|---|---|---|
| Encryption format | AES-256-GCM, 12 byte random IV per value, 16 byte tag. Files keep IV, tag and `key_version` in columns. Text uses `dc:v<n>:iv:tag:cipher` | Self-describing and rotatable |
| Key rotation | `ENCRYPTION_KEY` plus `ENCRYPTION_KEY_VERSION`, old keys in `ENCRYPTION_KEYS_PREVIOUS` (`1=base64:...`), `backend/bin/rotate-encryption.php` re-encrypts | Old data stays readable while new data uses the new key |
| Storage | A storage interface with a Supabase driver (REST, service key, private bucket) and a local driver, selected by `STORAGE_DRIVER`. Each report records its `storage_driver` | Works without Supabase and in tests |
| Stored object name | `reports/YYYY/MM/<32 hex>.bin` | Random, no user input, never executable |
| Upload validation | Type detected from file content, extension must match (`pdf`, `jpg` or `jpeg`, `png`), double extensions such as `.php.pdf` rejected, 10 MiB cap (413), metadata validated before the file is read, nothing stored on failure | Spec |
| Which text is encrypted | `reports.findings_encrypted` (clinical notes), `reports.impression_encrypted`, `referrals.clinical_notes_encrypted` | Reuses the original column instead of adding a duplicate |
| Visibility | Patients and referrers see only `final` and `amended` reports. Staff see drafts. Notes and impression go to staff only | Patients should not see unreleased work or internal notes |
| Referrer scope | Through `reports.appointment_id -> appointments.referral_id -> referrals.referrer_id`. Staff link a referral to an appointment with `PATCH /referrals/{id}`, which also sets the referral's patient | A referral alone never grants access to a patient's other reports |
| IDOR responses | Unauthorized report access returns 404 (same as an unknown id) and is written to `report_access_log` as `denied` and to `audit_log` | No way to test whether an id exists |
| Referral statuses | `submitted, accepted, scheduled, completed, report_ready, declined, cancelled`. Staff cannot set `submitted`. Linking an appointment moves `submitted` or `accepted` to `scheduled`. A final upload moves the referral to `report_ready` | Matches the schema |
| Delete | Admin only. The storage object is deleted, the row is soft-deleted (`deleted_at`), and the access log is kept | Keeps the audit trail |
| Download | The whole file is decrypted in memory, its SHA-256 is checked against the stored hash, and it is sent with nosniff and no-store. The frontend uses a plain link, so the browser handles the save | Files are capped at 10 MiB |
| Upload progress | The fetch-based client shows a busy spinner, not a byte-level progress bar | Fetch has no upload progress events |
| `.gitignore` | `!backend/src/Services/Storage/` and `!api/src/services/storage/` are un-ignored | The `storage/` rule would otherwise also match these source directories on case-insensitive file systems |

## Admin and reviews

- One review per appointment (unique constraint). Only the owning patient can review, and only when the appointment is `completed`. Other patients get 404. Reviews start `pending` with `verified_visit = TRUE`, the display name defaults to first name plus last initial, and a publication consent checkbox is required. Submissions are throttled to 5 per hour.
- Admins can also add reviews that were copied by hand from Google (`POST /admin/reviews`). Google reviews are hidden from the public site by migration 022.
- Users are never deleted, only deactivated (history, immutable alert events). An admin cannot deactivate or re-role themselves and the last active admin is protected. Role changes are limited to receptionist, doctor and admin.
- Other deletes return 409 when a record is in use (foreign key violation), telling the admin to deactivate instead.
- Settings: legal texts, JSON and image settings are read-only in the admin. Optional values cleared by the admin become placeholders again, and a real value clears `is_placeholder`. Required clinic and doctor identity values cannot be cleared. URLs must be https with no credentials. Phones use the Indian mobile pattern, so landline numbers are not accepted.
- Doctor photo: stored in `api/storage/uploads/doctor` (`backend/storage/uploads/doctor` in PHP), checked by content type (JPEG, PNG, WebP), 2 MB, 200 to 6000 pixels, random file name, served by `GET /public/doctor/photo`. `doctor.photo_url` points to it.
- The statistics window is the last N days (default 30) by visit date. Cancelled bookings are excluded from the chart.
- Slot capacity cannot go below current bookings (row lock). Bulk generation reuses `SlotGenerator` with a dry-run option and a 20000 row cap.
- Admin list endpoints put pagination in `data`, because the frontend `api` client returns only `data`.
- Reception can cancel and reschedule from each row and can book on behalf of a new or existing patient on `/portal/reception/walk-in`, using `GET /patients/lookup`.
