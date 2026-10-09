# API Reference

Source of truth: `backend/routes/api.php` (PHP API) and `services/alerts/src/app.js` (Node worker). Postman collection: `postman/`.

## Conventions

- Base path: `/api/v1`. JSON in and out, except report upload (`multipart/form-data`), report download (binary), `.ics` download and the doctor photo.
- Envelope: success `{ "data": ..., "error": null, "meta"?: ... }`; failure `{ "data": null, "error": { "code", "message", "fields"? } }`.
- Auth: PHP session cookie `dc_session` (plus optional `dc_remember`). "Session" below means any signed-in user; roles narrow it. Role names: patient, receptionist, doctor, admin, referrer. Admin may use most staff endpoints.
- CSRF: fetch a token with `GET /auth/csrf` and send it in `X-CSRF-Token` on every POST, PUT, PATCH and DELETE (including login and register).
- Throttles are shown as `name max/minutes` (per user, or per IP when signed out). Exceeding one returns 429 with `Retry-After`.
- Status codes: 200, 201 created, 204 no content, 400 malformed, 401 not signed in, 403 role not allowed or CSRF/origin failure, 404 missing or not yours, 409 conflict (slot full, in use), 413 file too large, 419 CSRF token expired, 422 validation, 429 throttled, 500 generic.
- Ids are UUIDs. Paths with `{id}` accept only UUIDs.

## Why each HTTP method

| Method | Used for | Properties relied on |
|---|---|---|
| GET | Reading data, downloads, `.ics` | Safe and cacheable by intent; never changes state, so it needs no CSRF token |
| POST | Creating a record or triggering an action that is not idempotent (register, login, book, upload, flag critical, acknowledge, generate slots) | Repeating it can create a new record, so it is guarded by CSRF and throttles |
| PUT | Replacing a whole admin record (branches, catalog, FAQs) and changing the password | Idempotent: sending the same body twice leaves the same state |
| PATCH | Partial changes: profile, reschedule, cancel, status, moderate, resolve, report metadata, settings | Only the supplied fields change; cancel and reschedule are state transitions, not deletions |
| DELETE | Removing something: end all sessions, soft-delete a report, delete admin catalog rows, remove the doctor photo | Idempotent removal; bookings are cancelled with PATCH instead because the record must be kept |

Admin update routes accept both PUT and PATCH for the same handler so a client may send either a full replacement or a partial change.

## Health and public content (no sign-in)

| Method | Path | Roles | Purpose | Why this method |
|---|---|---|---|---|
| GET | `/health` | public | Liveness check used by hosting | Read-only probe |
| GET | `/public/site` | public | Site settings, contact details, clinic info | Read-only |
| GET | `/public/doctor` | public | Doctor profile | Read-only |
| GET | `/public/doctor/photo` | public | Doctor photo bytes | Binary read |
| GET | `/public/branches` | public | Active branches | Read-only |
| GET | `/public/scan-categories` | public | Category tree (USG, CT, Biopsy and subgroups) | Read-only |
| GET | `/public/scan-types` | public | Searchable scan list (filters by modality and text) | Read-only; filters as query string |
| GET | `/public/scan-types/{ref}` | public | One scan by id or slug with preparation tips | Read-only |
| GET | `/public/faqs` | public | Published FAQs | Read-only |
| GET | `/public/reviews` | public | Approved reviews with average and count | Read-only |

## Authentication and account

| Method | Path | Roles | Purpose | Why this method |
|---|---|---|---|---|
| GET | `/auth/csrf` | public | Issue the CSRF token | Safe read of a derived value |
| POST | `/auth/register` | public (`register 10/60`) | Create a patient or referrer account | Creates a user |
| POST | `/auth/login` | public (`login 20/10`) | Sign in, optional remember-me | Creates a session; credentials stay out of the URL |
| POST | `/auth/logout` | public | End the current session | State-changing action, CSRF protected |
| GET | `/auth/me` | session | Current user and role | Read-only |
| PATCH | `/auth/me` | session | Update own profile fields | Partial update |
| DELETE | `/auth/sessions` | session | Revoke all remember-me tokens and sign out | Removes the user's sessions |
| POST | `/auth/password/forgot` | public (`forgot 5/15`) | Email a reset link (same reply for unknown emails) | Triggers an action |
| POST | `/auth/password/reset` | public (`reset 10/15`) | Set a new password with the emailed token | Consumes a one-time token |
| PUT | `/auth/password` | session (`password-change 10/15`) | Change own password | Replaces the credential |
| POST | `/auth/email/verify` | public (`verify 20/15`) | Confirm email with the emailed token | Consumes a one-time token |
| POST | `/auth/email/resend` | session (`verify-resend 3/15`) | Send a new verification email | Triggers an action |

## Booking and appointments

| Method | Path | Roles | Purpose | Why this method |
|---|---|---|---|---|
| GET | `/booking/availability` | session | Slots for branch, modality and date with remaining capacity | Read-only |
| GET | `/booking/days` | session | Days with free slots for a calendar | Read-only |
| GET | `/booking/next-available` | session | Earliest slot, used for the other-branch suggestion | Read-only |
| GET | `/scan-types/{id}/checklist` | session | Pre-scan safety checklist for a scan | Read-only |
| GET | `/appointments` | patient (own), receptionist, doctor, admin | List appointments, filtered by role | Read-only |
| POST | `/appointments` | patient, receptionist, admin; verified email (`booking 30/60`) | Book a slot inside a locking transaction; 409 returns a suggestion when full | Creates an appointment |
| GET | `/appointments/{id}` | patient (own), receptionist, doctor, admin | One appointment with checklist answers | Read-only; non-owners get 404 |
| GET | `/appointments/{id}/ics` | same as above | Calendar file download | Read-only file response |
| PATCH | `/appointments/{id}/reschedule` | patient (own), receptionist, admin; verified email (`booking-change 30/60`) | Move to another slot atomically | State transition on an existing record |
| PATCH | `/appointments/{id}/cancel` | patient (own), receptionist, admin (`booking-change 30/60`) | Cancel and release the slot | Record is kept for history, so not DELETE |
| PATCH | `/appointments/{id}/status` | receptionist, doctor, admin | Change status or urgency (check in, complete, no-show) | Partial update |

## Reports, referrals, reviews

| Method | Path | Roles | Purpose | Why this method |
|---|---|---|---|---|
| GET | `/reports` | patient and referrer (released, own), receptionist, doctor, admin | List reports with filters | Read-only |
| POST | `/reports` | doctor, receptionist, admin (`report-upload 30/60`) | Upload an encrypted PDF, JPG or PNG with notes | Creates a report |
| GET | `/reports/{id}` | as list | Report metadata (logs a view) | Read-only; unauthorized gets 404 |
| GET | `/reports/{id}/download` | as list (`report-download 120/60`) | Decrypted file as an attachment (logged) | Binary read |
| PATCH | `/reports/{id}` | doctor, receptionist, admin | Update title, notes, impression, status | Partial update |
| DELETE | `/reports/{id}` | admin | Remove the stored object and soft-delete the row | Removal |
| POST | `/referrals` | referrer (`referral-create 30/60`) | Create a referral | Creates a record |
| GET | `/referrals` | referrer (own), receptionist, doctor, admin | List referrals | Read-only |
| GET | `/referrals/{id}` | same | One referral | Read-only |
| PATCH | `/referrals/{id}` | receptionist, doctor, admin | Update status or link an appointment | Partial update |
| GET | `/reviews/mine` | patient | Own reviews and visits eligible for review | Read-only |
| POST | `/reviews` | patient (`reviews 5/60`) | Submit a review for a completed visit (starts pending) | Creates a review |

## Doctor queue and critical alerts

| Method | Path | Roles | Purpose | Why this method |
|---|---|---|---|---|
| GET | `/doctor/queue` | doctor, admin | Priority reading queue with waiting times | Read-only |
| POST | `/reports/{id}/critical` | doctor, admin (`alert-flag 20/10`) | Flag a report critical; creates the alert and notifies | Creates an alert and sends email |
| GET | `/alerts/mine` | patient, referrer | Open alerts for the in-app banner | Read-only |
| GET | `/alerts` | receptionist, doctor, admin | Alert board including red-flagged ones | Read-only |
| GET | `/alerts/{id}/events` | receptionist, doctor, admin | Immutable event timeline | Read-only |
| POST | `/alerts/{id}/acknowledge` | patient, referrer (`alert-ack 30/10`) | Acknowledge and stop escalation | Appends an event; not idempotent |
| PATCH | `/alerts/{id}/resolve` | receptionist, admin | Close after phoning the patient, with a note | State transition |

## Dashboards

| Method | Path | Roles | Purpose | Why this method |
|---|---|---|---|---|
| GET | `/dashboards/patient` | patient | Summary for the patient home | Read-only |
| GET | `/dashboards/doctor` | doctor, admin | Summary for the doctor home | Read-only |
| GET | `/dashboards/receptionist` | receptionist, admin | Summary for reception | Read-only |
| GET | `/dashboards/admin` | admin | Summary for admin | Read-only |
| GET | `/dashboards/referrer` | referrer | Summary for the referrer | Read-only |

## Admin (all require the admin role)

| Method | Path | Purpose | Why this method |
|---|---|---|---|
| GET | `/admin/stats` | Appointments per day and branch | Read-only |
| GET | `/admin/audit-log` | Paged, filterable audit log | Read-only |
| GET | `/admin/users` | List users | Read-only |
| POST | `/admin/users` | Create a staff user | Creates a record |
| PATCH | `/admin/users/{id}` | Change role, active flag or details (users are deactivated, never deleted) | Partial update |
| POST | `/admin/users/{id}/password-reset` (`admin-password-reset 20/60`) | Send a reset link to a user | Triggers an action |
| GET, POST | `/admin/branches` | List and create branches | Read and create |
| PUT, PATCH, DELETE | `/admin/branches/{id}` | Replace, edit, delete a branch | Replace, partial, remove |
| GET, POST | `/admin/scan-categories` | List and create categories | Read and create |
| PUT, PATCH, DELETE | `/admin/scan-categories/{id}` | Replace, edit, delete | Replace, partial, remove |
| GET, POST | `/admin/scan-types` | List and create scan types | Read and create |
| PUT, PATCH, DELETE | `/admin/scan-types/{id}` | Replace, edit, delete | Replace, partial, remove |
| GET, POST | `/admin/checklist-items` | List and create checklist items | Read and create |
| PUT, PATCH, DELETE | `/admin/checklist-items/{id}` | Replace, edit, delete | Replace, partial, remove |
| GET | `/admin/slots` | List slots | Read-only |
| POST | `/admin/slots/generate` (`admin-slot-generate 20/60`) | Bulk-create slots, with dry run | Creates many records |
| PATCH | `/admin/slots/{id}` | Change capacity or block a slot (never below current bookings) | Partial update |
| DELETE | `/admin/slots/{id}` | Delete an unused slot | Removal |
| GET | `/admin/settings` | Site settings | Read-only |
| PATCH | `/admin/settings` | Update contact details, hours, links | Partial update of many keys |
| POST | `/admin/doctor/photo` | Upload the doctor photo (multipart) | Creates or replaces the stored file |
| DELETE | `/admin/doctor/photo` | Remove the photo | Removal |
| GET, POST | `/admin/faqs` | List and create FAQs | Read and create |
| PUT, PATCH, DELETE | `/admin/faqs/{id}` | Replace, edit, delete | Replace, partial, remove |
| GET | `/admin/reviews` | Reviews by status | Read-only |
| PATCH | `/admin/reviews/{id}` | Approve or reject | Partial update (status) |

## Alerts worker (`services/alerts`, port `ALERTS_SERVICE_PORT`)

Not part of the PHP API. Management endpoints need the header `Authorization: Bearer <ALERTS_SERVICE_TOKEN>` or `X-Service-Token` (see `services/alerts/src/http/auth.js`). The service sends the same envelope.

| Method | Path | Auth | Purpose | Why this method |
|---|---|---|---|---|
| GET | `/health` | none | Liveness | Read-only |
| GET | `/` | none | Static status page (`services/alerts/public`) | Static file |
| GET | `/api/status` | none | Job state and alert counts for the status page | Read-only |
| GET | `/api/alerts/open` | service token | Open alerts (ids and timers only, no clinical data) | Read-only |
| POST | `/api/jobs/escalate/run` | service token | Run the escalation job now (409 if already running) | Triggers work; not idempotent |
| POST | `/api/jobs/reminders/run` | service token | Run the appointment reminder job now | Triggers work |
| GET | `/api/logs/tail?lines=N` | service token | Last N lines (1 to 1000) of the rotating audit log | Read-only |
