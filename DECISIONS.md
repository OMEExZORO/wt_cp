# Decisions

Defaults chosen during the build. Each can be revisited.

## Infrastructure

| Topic | Decision | Reason |
|---|---|---|
| Repository | Monorepo, branch `main`, public GitHub remote | Spec requirement; secrets stay in untracked `.env` files |
| Database | Supabase PostgreSQL | Spec requirement |
| DB credentials | Dedicated role `diagnocare_app` with `BYPASSRLS` and `CREATE` on schema `public`, instead of the `postgres` superuser password | Least privilege; the app role can be rotated or revoked without touching the Supabase admin account |
| Pooler modes | App runtime uses the transaction pooler (port 6543) with `PDO::ATTR_EMULATE_PREPARES = true`; migrations and seeds use the session pooler (port 5432, `DB_MIGRATE_PORT`) | Transaction pooling does not support server-side prepared statements; DDL and advisory locks need a session |
| Row Level Security | Enabled on every table with no policies; `anon` and `authenticated` have no table grants | Only the server-side `diagnocare_app` connection (BYPASSRLS) can read or write; the Supabase REST API exposes nothing |
| Storage | Private Supabase Storage bucket `reports` (`public = false`, 15 MiB object limit), created by `backend/bin/storage-setup.php` through the Storage REST API with the service key | Files are encrypted by PHP before upload, so the object limit leaves room for the 10 MiB plaintext cap plus overhead |
| Auth | PHP native sessions and cookies; Supabase Auth not used | Syllabus requirement |
| Timezone | `Asia/Kolkata` for PHP and DB sessions; columns are `TIMESTAMPTZ` | Single-city clinic |
| PHP | Plain PHP 8.3, PSR-4 `App\` autoload via Composer, PHPUnit 11 | Spec: no framework |
| Frontend | React 18.3 pinned (Vite templates now default to 19), TypeScript 5.8, Vite 8, Vitest 5 | Spec requires React 18 |
| Node worker | Express 5, `pg`, `dotenv`, ESM | Current stable versions |
| Root scripts | `concurrently` runs API, frontend and worker with `npm run dev` | Works without Docker |

## Data model

| Topic | Decision |
|---|---|
| Primary keys | UUID for entities (harder to enumerate, defence in depth against IDOR); identity BIGINT for append-only logs |
| Enums | `TEXT` + `CHECK` constraints rather than Postgres enum types, so migrations can extend them easily |
| Services | Modelled as `scan_categories` (top level USG / CT / BIOPSY with child subgroups Obstetrics, Gynecology, General and Specialized, Prostate Imaging, USG Guided, CT Guided) and 56 `scan_types` matching the brochure list exactly. `modality` is denormalised onto `scan_types` for filtering |
| Slots | One row per branch + modality + date + start time with `capacity` and `booked_count`; USG, CT and biopsy use separate equipment so they are scheduled independently |
| Duplicate bookings | Partial unique index: one non-cancelled appointment per patient per slot |
| Checklists | Items apply to a whole modality (e.g. CT contrast allergy) or a single scan type (e.g. full bladder for pelvic USG). `attention_answers` lists answers that flag staff review |
| Scan durations | Default durations in `scan_types.duration_minutes` are scheduling defaults only, are not shown as claims, and are editable by admin |
| Fees | `scan_types.fee_inr` exists but is NULL everywhere; fees are unknown and not shown |
| Patient gender | Optional patient gender field (female, male, other, prefer_not_to_say) for clinical context only. There is no fetal-sex field anywhere |
| Patients vs users | `patients.user_id` is nullable so reception can register walk-in patients without portal accounts |
| Alert audit trail | `alert_events` rejects UPDATE, DELETE and TRUNCATE by trigger; FKs into it use `ON DELETE RESTRICT`, so users are deactivated rather than deleted |
| Token storage | Remember-me uses selector + SHA-256 validator hash; reset and verification tokens are stored only as hashes |
| Lockout | `users.failed_login_count` and `users.locked_until`, plus a `login_attempts` table for IP and email throttling |
| Unknown content | `site_settings.value = NULL` with `is_placeholder = TRUE`; frontend shows "TODO: add real value" only in dev builds. Branch 2 is seeded inactive with address `TODO: add real value`; the dev seed activates it so the "other branch" suggestion can be tested |
| Migration fix | Migration 011 replaces `checklist_items.attention_answer` with `attention_answers TEXT[]` rather than editing the already-applied migration 004 |
| Emergency number | Disclaimer refers to 112, India's national emergency number |

## Development data

- Dev users use the reserved `.test` domain and documented passwords (see `docs/CONVENTIONS.md`). They exist only through `seed.php dev`, which refuses to run with `APP_ENV=production`.
- Dev slots run 09:00 to 17:00, Monday to Saturday, for 14 days. Real opening hours are unknown.
- Demo reviews are labelled "Demo data" in both name and text, flagged `is_demo = TRUE`, and removable with `npm run seed:purge-demo`.

## Phase 2: PHP core and auth

| Topic | Decision | Reason |
|---|---|---|
| Framework | Own small MVC core (Router, Kernel, middleware Pipeline, autowiring Container) instead of a framework | Spec: plain PHP; keeps every concept visible for the syllabus |
| Response flow | Controllers return `Response` objects; middleware can add headers; only `public/index.php` sends output | Testable and lets CORS and security headers apply to error responses too |
| Route matching | Done before the session starts (`MatchRouteMiddleware`) | 404 / 405 come back before CSRF and do not create session files |
| Sessions | Native PHP file sessions in `backend/storage/sessions`, cookie `dc_session`, idle 30 min, absolute 12 h | Syllabus requires PHP sessions. Containers lose sessions on restart; remember-me restores them. A DB session handler can be added in Phase 8 if several API instances run |
| Cookie flags | HttpOnly always; SameSite=Lax and not Secure in development; SameSite=None and Secure in production (`SESSION_SAMESITE`, `SESSION_SECURE`) | Spec; production frontend and API are on different sites |
| Dev same-origin | Vite proxies `/api` to the PHP server; `VITE_API_BASE_URL=/api/v1` | Cookies work in development without third-party cookie rules |
| CSRF | Synchronizer token: random seed in the session, token = HMAC-SHA256(seed, `CSRF_SECRET`), sent in `X-CSRF-Token` on every POST, PUT, PATCH, DELETE including login and register; not rotated at login | Covers login CSRF; the client refetches once on 419 |
| Origin check | Unsafe requests carrying an `Origin` header not in the allowlist get 403 | Defence in depth next to CSRF |
| Email verification | Login is allowed before verification. The portal shows a banner with a resend button. Features that need a verified email use the `verified` middleware (Phase 4 applies it to booking) | Patients can still reach the portal if mail is delayed |
| Duplicate registration | 409 with a field error on `email` | Usability; enumeration is limited by the register throttle (10 per hour per IP) |
| Lockout | 5 failed passwords lock the account for 15 min (429 with `Retry-After`); unknown emails get the same treatment through `login_attempts`; the login route is also throttled per IP (20 per 10 min); generic message "Incorrect email or password." | Spec; uniform behaviour avoids revealing which emails exist |
| Rate limiting | Table `rate_limits` (migration 012) with an atomic upsert fixed window, keyed by limiter name and user id or IP | Works with several PHP processes; no Redis needed |
| Remember me | Cookie `selector.validator`; validator rotated on each use; previous validator accepted for 60 s; any other mismatch deletes all of the user's tokens | Rotation plus theft detection, tolerant of parallel first requests |
| Session invalidation | Each request reloads the user; the session is dropped if the user is inactive, the role changed or `password_changed_at` is newer than the login | Password reset and change sign out other devices; admin role changes take effect immediately |
| "Sign out everywhere" | `DELETE /auth/sessions` revokes all remember-me tokens and ends the current session; other live sessions end at their idle timeout | No session registry needed |
| Consent | Stored on `users.consent_given_at` / `consent_version` (both roles) and on `patients` for patients; current version `2026-10-v1` | DPDP-style record of when consent was given |
| Validator scope | Only declared fields are returned; undeclared input is dropped. Passwords and tokens are not cleaned or scanned; everything else is cleaned, length capped (255 by default) and scanned for HTML and SQL patterns | Spec: apply to every field before writes; passwords are only hashed |
| Threat handling | Suspicious input is rejected (422), never silently stripped, and logged to `audit_log` as `security.sqli_attempt` / `security.xss_attempt` with a 200-character sample | Spec |
| Mail | `MAIL_DRIVER=log` (default) writes to `backend/storage/logs/mail.log`; `smtp` uses PHPMailer 6 | Works without SMTP credentials in development |
| Timestamps | JSON timestamps are ISO 8601 with offset | Safe `Date` parsing in every browser |
| Theme cookie | `theme` cookie (light or dark) set by the frontend `ThemeContext`; not read by the server | The "theme or language cookie" requirement; Context only for theme |

## Phase 3: public site

- No contact-form table exists, so there is no `POST /public/contact`. The Contact page shows phone, WhatsApp, email and hours (tel, wa.me and mailto links) and tells visitors not to send medical details by email.
- All "Book an appointment" buttons go to `/book`, an explainer page whose button leads to `/portal/patient/book` (login required, handled by `ProtectedRoute`).
- Placeholders show a "TODO: add real value" badge only when `import.meta.env.DEV`; in production the field, and the sticky-bar Call and WhatsApp buttons, are omitted.
- The Services list is fetched once into Redux and filtered client-side with `useMemo`; the filter state lives in `ServicesPage` and is passed down. The scan detail page uses `useApiQuery` because only that page needs it.
- Fonts: Fraunces (headings) and Figtree (body), loaded from Google Fonts in `index.html`. The existing light/dark theme toggle is kept; dark overrides are in `tokens.css`.
- No stock photos are used. Illustrations are inline SVG. The logo is an SVG placeholder monogram until the real logo is supplied.
- Privacy and Terms are drafts marked "Pending doctor and legal review".
- Seeded FAQ "Will the centre tell me the sex of my baby?" (from Phase 1 seed) is rendered as-is; the doctor should confirm whether to keep it.

## Phase 5: reports and referrals

| Decision | Choice | Reason |
|---|---|---|
| Encryption format | AES-256-GCM, 12 byte random IV per value, 16 byte tag; files keep IV, tag and `key_version` in columns; text uses `dc:v<n>:iv:tag:cipher` | Self-describing and rotatable |
| Key rotation | `ENCRYPTION_KEY` plus `ENCRYPTION_KEY_VERSION`, old keys in `ENCRYPTION_KEYS_PREVIOUS` (`1=base64:...`), `bin/rotate-encryption.php` re-encrypts | Old data stays readable while new data uses the new key |
| Storage | `StorageService` interface; `SupabaseStorage` (REST via curl, service key, private bucket) and `LocalStorage` (`backend/storage/reports`), selected by `STORAGE_DRIVER` (default `local`); each report records its `storage_driver` | Works without Supabase and in tests |
| Stored object name | `reports/YYYY/MM/<32 hex>.bin` | Random, no user input, never executable |
| Upload validation | Real MIME through `finfo`; extension must match the MIME (`pdf`; `jpg` or `jpeg`; `png`); double extensions such as `.php.pdf` rejected; 10 MiB cap (413); metadata validated before the file is read; nothing is stored on any failure | Spec |
| Which text is encrypted | `reports.findings_encrypted` holds the clinical notes, new `reports.impression_encrypted` holds the impression, `referrals.clinical_notes_encrypted` the referral notes | Reuses the Phase 1 column instead of adding a duplicate |
| Visibility | Patients and referrers see only `final` and `amended` reports; staff see drafts. Notes and impression are returned to staff only | Patients should not see unreleased work or internal notes |
| Referrer scope | Through `reports.appointment_id -> appointments.referral_id -> referrals.referrer_id`; staff link a referral to an appointment with `PATCH /referrals/{id}` and `appointment_id`, which also sets the referral's patient | A referral alone never grants access to a patient's other reports |
| IDOR responses | Unauthorized report access returns 404 (same as an unknown id) and is written to `report_access_log` as `denied` and to `audit_log` | No existence oracle |
| Referral statuses | DB values `submitted, accepted, scheduled, completed, report_ready, declined, cancelled`; the spec words map to received = accepted, reported = report_ready; staff cannot set `submitted`; linking an appointment moves `submitted` or `accepted` to `scheduled`; a final upload moves the referral to `report_ready` | Matches the Phase 1 schema |
| Delete | Admin only: storage object deleted, row soft-deleted (`deleted_at`), access log kept | Keeps the audit trail |
| Download | Whole file decrypted in memory, SHA-256 checked against the stored hash, sent with nosniff and no-store; the frontend uses a plain link so the browser handles the save | Files are capped at 10 MiB |
| Upload progress | The fetch based client shows a busy state with a spinner, not a byte-level progress bar | Fetch has no upload progress events |
| `.gitignore` | Added `!backend/src/Services/Storage/` because the existing `storage/` rule also matched that source directory on case-insensitive filesystems | Keeps the storage service tracked |
| Model change | The `Model` column whitelist regex now allows digits (`sha256`) | Previously such columns were dropped silently |
