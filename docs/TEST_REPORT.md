# DiagnoCare Test Report (Phase 8A)

Run date: 2026-10-09, Windows 11, PHP 8.3.33, Node 24.18, branch `phase8-tests`. Backend served by `php -S localhost:8021 -t backend/public` with `ALERT_ESCALATION_MINUTES=1`; alerts worker on port 4021 (`ALERTS_JOBS_ENABLED=false` so only the token-protected run endpoint triggers jobs). Database: the development Supabase project with the dev seed. All numbers below are from real runs.

## Summary

| Suite | Command | Result |
|---|---|---|
| PHPUnit (unit and integration-style) | `php backend/vendor/bin/phpunit -c backend/phpunit.xml` | 431 tests, 976 assertions, 0 failures |
| Vitest (control, component, page) | `npm test --prefix frontend` | 12 files, 146 tests, 0 failures |
| Alerts worker | `npm test --prefix services/alerts` | 17 tests, 17 pass, 0 fail |
| Live validation attack check | `php backend/bin/validation-attack-check.php` | 45 of 45 passed, tables intact, DB row counts unchanged |
| Full-journey flow test | `node tests/flow/full-journey.mjs` | 15 of 15 steps passed in 260 s |
| Postman collection via newman | see below | 174 requests (266 HTTP calls including CSRF pre-fetches), 386 assertions, 0 failed, 4m 46s |

Newman command (the service token comes from the untracked `.env`; the committed environment holds a placeholder):

```
npx newman run postman/DiagnoCare.postman_collection.json -e postman/DiagnoCare.postman_environment.json \
  --working-dir postman --env-var baseUrl=http://localhost:8021/api/v1 \
  --env-var alertsUrl=http://localhost:4021 --env-var serviceToken=<ALERTS_SERVICE_TOKEN>
```

Newman reported: iterations 1/0 failed, requests 266/0 failed, test-scripts 174/0 failed, assertions 386/0 failed.

## Bug found and fixed by the tests

| Found by | Symptom | Cause | Fix |
|---|---|---|---|
| Flow test, step "doctor flags the report critical" | `POST /reports/{id}/critical` returned HTTP 500 SERVER_ERROR | `backend/config/container.php` used `EncryptedNoteProtector` without importing it, so the container could not build `AlertService` | Added the `use` line (commit "fix(alerts): import EncryptedNoteProtector ..."). `ContainerWiringTest` (38 cases) now resolves every controller, middleware and key service so a missing wiring fails in PHPUnit |

## 1. Control tests (Vitest)

| Test case | Input | Expected | Actual |
|---|---|---|---|
| Booking wizard Next button | Empty or partial step | Next disabled until step valid; booking only after consent | Pass |
| Login submit button | Empty, invalid, then valid form | Disabled until valid | Pass |
| Register submit button | Valid form without consent | Disabled until consent ticked | Pass |
| Report upload button | No file, bad file, valid file | Disabled until form and file valid | Pass |
| Referral send button | Missing or invalid fields | Disabled until valid | Pass |
| Alert flag dialog | Click "flag critical" then cancel | Confirmation dialog, nothing sent on cancel | Pass |

## 2. Unit tests (PHPUnit, 431 tests)

| Area | Tests | Expected | Actual |
|---|---|---|---|
| Validator | 48 | Rules, messages, threat detection | Pass |
| Sanitizer | 31 | SQLi/XSS patterns detected, benign text kept | Pass |
| EncryptionService | 12 | AES-256-GCM round trip, tamper and wrong-key failure, key versions | Pass |
| SlotCapacity, SlotGenerator | 17 + 4 | Capacity maths, no overbooking, generation windows | Pass |
| RoleMiddleware, AdminAccess | 33 + 8 | RBAC allow and deny per role | Pass |
| Router, Env | 12 + 3 | Route matching, env parsing | Pass |
| Booking, AppointmentController, ChecklistEvaluator, BookingTransition | 12 + 5 + 13 | Booking rules, status transitions, checklist flags | Pass |
| Reports (ReportUpload, ReportAccessPolicy) | 17 + 23 | Upload hardening, IDOR policy | Pass |
| Alerts (AlertWorkflow, ReadingQueue) | 21 + 5 | State machine, queue order | Pass |
| ReviewPolicy, SettingsValidation, AdminContent | 22 + 29 + 27 | Moderation rules, settings and catalog validation | Pass |
| Calendar, PublicContentPresenter | 5 + 8 + 8 | ICS, Google link, public presenter | Pass |
| ContainerWiringTest (new) | 38 | Every controller, middleware, AlertService, MailService, StorageService resolves | Pass (failed before the fix) |
| ValidationAttackMatrixTest (new) | 30 | See section 4 | Pass |

## 3. Page tests (Vitest, 146 tests in 12 files)

| Test case | Input | Expected | Actual |
|---|---|---|---|
| Login redirects each role | Patient, doctor, receptionist, admin, referrer sign in | Redirect to `/portal/patient`, `/portal/doctor`, `/portal/reception`, `/portal/admin`, `/portal/referrer` | Pass (5 cases) |
| Protected routes block guests | Guest opens each portal path | Redirect to login | Pass (patient, doctor, reception, admin, referrer, account) |
| Wrong role gets 403 page | Patient opens admin, referrer opens doctor | 403 page | Pass |
| Admin routes | Patient, receptionist, doctor, referrer open each `/portal/admin/*` section | Blocked | Pass (all sections) |
| Return to requested page | Guest asks for a page, logs in | Returned to it | Pass |
| Public pages | Services filters, FAQ keyboard use, reviews empty and placeholder states, branches map, footer PCPNDT notice | As specified | Pass |
| Alerts UI | Patient banner and acknowledge, failed acknowledge keeps banner, reception board red rows and note required | As specified | Pass |

## 4. Validation tests: hostile input rejected, nothing written

PHPUnit (`ValidationAttackMatrixTest`, 30 tests, asserts `ValidationException`, audit event `security.sqli_attempt` or `security.xss_attempt`, zero PDO writes, zero stored objects):

| Test case | Input | Expected | Actual |
|---|---|---|---|
| Register name, email, city, referrer clinic name | `' OR '1'='1`, `'; DROP TABLE users;--`, `<script>alert(1)</script>`, 20000 chars | Field error, no write | Pass |
| Register without consent | `consent=false` | Error on consent | Pass |
| Report title | the four payloads | Rejected before storage | Pass |
| Report notes | 5001 chars | Rejected | Pass |
| Wrong MIME with `.pdf` name | plain text, real PNG bytes, PHP script, HTML with script, SVG with script, empty file | 422 on `file`, nothing stored | Pass (6 cases) |
| Oversized file | 11 MB `huge.pdf` | PayloadTooLarge 413, nothing stored | Pass |

Live (`backend/bin/validation-attack-check.php`, real HTTP against the running API, table row counts, slot booked totals, patient names hash and stored file count compared before and after every request; run 2026-10-09):

| Group | Input | Expected | Actual |
|---|---|---|---|
| register (12 cases: 4 payloads x full_name, email, city) | the four payloads | HTTP 422 VALIDATION_FAILED, rows unchanged | 12/12 pass |
| login (5) | payloads in email; tautology in password | 422 for email, 401 for password; rows unchanged | 5/5 pass |
| booking (6) | payloads in `patient_notes`; tautology in `slot_id`; no consent | 422, no appointment, `booked_count` unchanged | 6/6 pass |
| profile `PATCH /auth/me` (4) | payloads in `full_name` | 422, patient names unchanged | 4/4 pass |
| staff search `q` (4) | payloads in query string | 422 | 4/4 pass |
| report upload fields (6) | payloads in title, 5001-char notes, tautology as appointment id | 422, no report row, no file | 6/6 pass |
| report upload files (8) | text, PHP, PNG, HTML named `.pdf`; `shell.php.pdf`; valid PDF named `.php`; empty `.pdf`; 11 MB `.pdf` | 422 (413 for 11 MB), no report row, no file | 8/8 pass (11 MB gave 413 PAYLOAD_TOO_LARGE) |

Final line of the run: `ATTACK CHECK RESULT: 45/45 passed`; tables intact after DROP TABLE attempts: yes; admin login still works: HTTP 200; 53 `security.*_attempt` audit rows recorded in the last 15 minutes. Note: a patient's `?q=` on `/appointments` is ignored (patients do not have a search filter), so that probe uses the staff list.

## 5. Flow test (`tests/flow/full-journey.mjs`, real API plus Node worker, 260 s)

| Step | Input | Expected | Actual |
|---|---|---|---|
| Health | API and worker `/health` | 200 | Pass |
| Register | New patient with consent | 201, unverified | Pass |
| Booking before verification | Book as unverified | 403 FORBIDDEN | Pass (HTTP 403) |
| Verify email | Token read from `backend/storage/logs/mail.log`; reuse the token | 200 then 422 | Pass |
| Find scan and slot | Early Pregnancy Scan, first open slot | Slot found | Pass |
| Book | Answers to the checklist, consent | 201 | Pass |
| Doctor upload | 279-byte PDF | 201 | Pass |
| Flag critical | Note | 201; duplicate flag 409 | Pass (after the container fix; first run exposed the 500) |
| Escalation token | No token, wrong token | 401 | Pass |
| Stage 1 escalation | Window 1 minute; `POST /api/jobs/escalate/run` | `resent:1`, `escalated` event | Pass |
| Stage 2 escalation | Second window | `staff_flagged` event | Pass |
| Acknowledge | Patient banner, acknowledge, rerun job | `acknowledged` event; job checks 0 | Pass |
| Download | Patient downloads report | Bytes identical (sha256 prefix b6a03452a77f356e), `application/pdf`, attachment, nosniff | Pass |
| IDOR | Other patient downloads | 403 or 404 | Pass (404) |

Result: `FLOW RESULT: 15/15 steps passed in 260s`. Cleanup performed: appointment cancelled, report deleted by admin, test user deactivated.

Leftover dev data from the flow runs (labelled, cannot be removed): user "Flow Test ..." with email `flow.<id>@diagnocare.test` (deactivated; two earlier aborted runs left two more deactivated "Flow Test" users, one with a cancelled appointment), the critical alert row `524edefc-6afa-43d2-a4a3-53b9cac0f656` and its append-only `alert_events` rows, audit_log and report_access_log rows, and mail.log entries.

## 6. API tests (Postman collection run with newman)

Collection: `postman/DiagnoCare.postman_collection.json` (environment `postman/DiagnoCare.postman_environment.json`, fixtures in `postman/fixtures/`). 174 requests in 9 folders: public content, auth, patient, doctor, alerts worker, patient acknowledge and download, referrer, receptionist, admin. It covers all routes in `backend/routes/api.php` and all alerts worker routes. A collection pre-request script fetches `/auth/csrf` and sets `X-CSRF-Token` for every unsafe request; role sessions come from the cookie set by each Login request. Every request asserts status and the envelope (`data` and `error`, error code and message on 4xx).

| Folder | Requests | Notable assertions | Actual |
|---|---|---|---|
| 00 Health and public | 11 | Branches, catalogue above 40 scans, unknown scan 404 NOT_FOUND | Pass |
| 01 Auth | 19 | Login without CSRF 403, wrong password 401 generic, SQLi login, script-tag register 422 with field error, no consent 422, register 201, profile, resend, bad verify and reset tokens 422, logout, me 401 | Pass |
| 02 Patient | 26 | Days, availability, checklist, XSS notes 422, book 201, list, ICS, reschedule, RBAC 403s, foreign id 404 | Pass |
| 03 Doctor | 20 | Wrong-MIME upload 422, PDF upload 201, download is PDF with nosniff, flag critical 201, duplicate 409, doctor cannot delete 403 | Pass |
| 04 Alerts worker | 11 | 401 without or with wrong token, escalate and reminders run 200, logs tail validation 422, unknown route 404 | Pass |
| 05 Patient acknowledge | 8 | Banner lists alert, acknowledge, gone from banner, download, cancel, cancel again conflict | Pass |
| 06 Referrer | 10 | Script-tag referral 422, create 201, cannot PATCH or book 403 | Pass |
| 07 Receptionist | 14 | Staff booking 201, cancel, resolve alert, referral PATCH, delete report 403 | Pass |
| 08 Admin | 55 | CRUD for users, branches, categories, scan types, checklist items, slots (dry run, generate, patch, delete), settings, doctor photo, FAQs, reviews, report delete 204 then 404; weak password and script FAQ 422 | Pass |

Cleanup: every entity created by the collection is deleted inside the run. Leftovers: a deactivated "Postman Staff" user per run (`staff.<id>@diagnocare.test`), deactivated throwaway patients `postman.<id>@diagnocare.test`, a declined "Postman Referral Patient" referral per run, cancelled appointments, audit rows. The first, broken newman attempts (script syntax error) created a stray `postman-*` branch, category, FAQ and slot set; they were removed by hand.

## Reproducing

```
php backend/vendor/bin/phpunit -c backend/phpunit.xml
npm test --prefix frontend
npm test --prefix services/alerts
ALERT_ESCALATION_MINUTES=1 php -S localhost:8021 -t backend/public
ALERT_ESCALATION_MINUTES=1 ALERTS_SERVICE_PORT=4021 ALERTS_JOBS_ENABLED=false node services/alerts/src/index.js
php backend/bin/validation-attack-check.php http://localhost:8021/api/v1
node tests/flow/full-journey.mjs
```

The attack check and flow scripts refuse or are intended for development databases only (the attack check exits when `APP_ENV=production` and clears the `rate_limits` table between groups). Postman login throttling (20 per 10 minutes) applies when the collection is rerun repeatedly; clear `rate_limits` in the dev database if it trips.
