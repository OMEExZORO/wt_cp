# Progress

What was built, in the order it was built, and how each part was checked. All parts listed here are complete.

## Summary

| Area | Result |
|---|---|
| Database | 21 migrations (001 to 022, 016 unused) creating 25 tables plus `schema_migrations`. Row level security on every table. Base seed: 4 branches, 56 scan types, checklist items, FAQs and site settings |
| Node.js API (`api/`) | 101 routes in 22 modules. 330 tests in 54 suites |
| PHP reference API (`backend/`) | The same 101 routes. 441 PHPUnit tests, 1008 assertions |
| Alerts worker (`services/alerts/`) | Escalation, reminders, status page, rotating log. 17 tests |
| Frontend (`frontend/`) | React 18 app with public site, patient, reception, doctor, referrer and admin portals. 161 Vitest tests in 16 files |
| End-to-end | Postman collection (174 requests, 386 assertions), full journey script (15 steps), 45-case live attack check on the PHP API |
| Delivery | Docker images for the API and the worker, `render.yaml`, Vercel configuration, CI workflow, scheduled alert job |

## Build history

1. Scaffold and database. Monorepo with `frontend`, `backend`, `services/alerts`, `database`, `docs` and `postman`. The first 11 migrations created 24 tables with `updated_at` triggers, an immutable `alert_events` table and row level security. A private Storage bucket `reports` was created.
2. PHP core and authentication. Router, kernel, middleware pipeline, autowiring container, session, cookies, CSRF, validator and sanitizer, error handling, mail, rate limiting, lockout, remember-me and role-based access. Migration 012 added consent fields, remember-token rotation columns and `rate_limits`.
3. Public site. Read-only public endpoints (site settings, doctor, branches, categories, scan types, FAQs, approved reviews), the public pages, structured data and sitemap generation.
4. Booking. Availability, days, checklist, booking inside a row-locking transaction, reschedule, cancel, status changes, `.ics` file and Google Calendar link, and the booking wizard with the other-branch suggestion when a branch is full.
5. Reports and referrals. AES-256-GCM encryption with key versions and rotation, private storage, upload hardening, referrer access through referrals, and the matching portal pages. Migration 014.
6. Critical alerts. Flagging, patient and referrer acknowledgement, escalation by the worker, the staff alert board, the reading queue and the in-app banner. Migration 015.
7. Admin panel and reviews. Admin CRUD for users, branches, categories, scan types, checklist items, slots, FAQs and settings, statistics, audit log viewer, doctor photo, and review submission and moderation.
8. Testing and hardening. PHPUnit container wiring and attack matrix tests, the live attack check, the full journey script, the Postman collection, a patient lookup for walk-in booking, reception reschedule and cancel, accessibility and Lighthouse fixes. A missing import in `backend/config/container.php` that made flagging a report critical return 500 was found by the journey script and fixed.
9. Deployment. Dockerfiles, `render.yaml`, Vercel rewrite and headers, GitHub Actions for CI, the keep-alive ping and the scheduled alert job. Live at `meghnaddiagnostics.me` with a same-origin `/api` rewrite.
10. Node.js API. The PHP API was ported to `api/` and is now what Render builds. Sessions moved to the `http_sessions` table (migration 020). Migrations 017 to 022 added review sources and flags, the official branch list, session storage, opening hours and affiliation, and the doctor biography.
11. Frontend polish. Header and hero layout fixes, dark mode logo, cookie consent banner, SEO structured data, Lighthouse scores of 90 or more on performance for the home, services and login pages.

## How it was verified

- Node API: `node --test` in `api` passes 330 tests without a database.
- Parity: the same Postman collection ran against the Node API (266 HTTP calls, 174 test scripts, 386 assertions, 0 failed). A status and masked-body comparison of Node and PHP on the same database made 289 requests with no unexplained differences. Argon2id hashes and AES-GCM envelopes written by one side were read by the other.
- Journey: `tests/flow/full-journey.mjs` registers a patient, verifies email, books, uploads a report, flags it critical, runs both escalation stages, acknowledges, downloads and checks that another patient cannot download it. 15 of 15 steps passed on both APIs.
- Hostile input: `backend/bin/validation-attack-check.php` sent 45 injection, script and upload-abuse requests and compared table counts before and after each. 45 of 45 passed, and no table changed.
- Encryption: a report uploaded to the private bucket is not readable as a PDF, its public URL is refused, and the downloaded bytes are identical to the upload.
- Concurrency: `backend/bin/prove-booking-concurrency.php` is a script that books the same slot from several processes and checks that capacity holds. It writes temporary rows, so it refuses to run in production.
- Frontend: 161 Vitest tests, `tsc -b` and `npm run build` pass. Lighthouse (mobile, Vite preview) after fixes: Home 93/100/100/100, Services 95/100/100/100, Login 90/100/100/100 (performance, accessibility, best practices, SEO).
- Docker: the images were not built locally because the Docker daemon was not running on the development machine. Render builds them on each deploy, and `docker compose config` was used only for static checks.

Test cases and results are in [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## Data left in the shared database

The immutability trigger and `RESTRICT` foreign keys stop test rows in `alert_events` and their parents from being deleted. The development runs left labelled rows: appointments with reference codes starting `DEVP6`, a referral `DEVP6-REF`, reports with storage paths under `devp6/`, two critical alerts and their events, and deactivated users named "Flow Test", "Postman Staff" and similar (emails `flow.<id>@diagnocare.test`, `staff.<id>@diagnocare.test`, `postman.<id>@diagnocare.test`). A production deployment should use a separate Supabase project seeded with `npm run seed` only.
