# DiagnoCare Alerts Service

Node.js (ESM) + Express 5 worker. It escalates unacknowledged critical findings, sends appointment reminders, writes a rotating audit log and serves a small status page.

## Run

```bash
cd services/alerts
npm install
npm test
npm start
npm run dev
```

Open `http://localhost:4000/` for the status page.

## Environment

Read from `services/alerts/.env`, then the repo root `.env`. Real environment variables win.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | none | Supabase pooler connection string. `sslmode` is removed from the URL and TLS is used with `rejectUnauthorized: false`, because the pooler certificate chain is not in Node's trust store. Falls back to `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. |
| `ALERTS_SERVICE_PORT` | 4000 | HTTP port |
| `ALERTS_SERVICE_TOKEN` | none | Shared secret for internal endpoints. Without it they return 503. Send as `X-Service-Token` or `Authorization: Bearer`. |
| `ALERT_ESCALATION_MINUTES` | 30 | Window for each escalation stage |
| `REMINDER_LEAD_HOURS` | 24 | How far ahead reminders are sent |
| `JOB_INTERVAL_SECONDS` | 60 | Scheduler tick |
| `ALERTS_JOBS_ENABLED` | true | Set `false` to disable the scheduler (endpoints still work) |
| `MAIL_DRIVER` | log | `log` appends to `logs/mail.log`; `smtp` uses nodemailer |
| `MAIL_FROM`, `MAIL_FROM_NAME`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ENCRYPTION` | | SMTP settings (`SMTP_ENCRYPTION=ssl` means implicit TLS) |
| `FRONTEND_URL` | http://localhost:5173 | Link used in emails |
| `ALERTS_LOG_DIR`, `ALERTS_LOG_MAX_BYTES`, `ALERTS_LOG_KEEP` | logs, 1048576, 7 | Audit log location, size cap, archives kept |
| `APP_ENV` | development | `production` turns on HSTS |

## Endpoints

JSON envelope `{ data, error }`.

| Method and path | Auth | Description |
|---|---|---|
| `GET /health` | none | Liveness |
| `GET /api/status` | none | Job last-run times and results, counts of open, escalated and staff-flagged alerts |
| `GET /api/alerts/open` | token | Unacknowledged alerts with escalation level |
| `POST /api/jobs/escalate/run` | token | Run escalation now |
| `POST /api/jobs/reminders/run` | token | Run reminders now |
| `GET /api/logs/tail?lines=100` | token | Last lines (1 to 1000) of the audit log |

## Escalation

An alert is a row of `critical_alerts` that is `open`, `notified` or `escalated` with no `acknowledged_at`. The decision is the pure function `decideEscalation` in `src/jobs/escalationLogic.js`.

- Level 0, due at `next_escalation_at` (or `last_notified_at`/`created_at` plus the window): resend to the patient and the referring doctor, insert `resent` events (or `delivery_failed`) and an `escalated` event (stage 1), set `status = 'escalated'`, `escalation_level = 1`, `last_notified_at = now()`, `next_escalation_at = now() + window`.
- Level 1, due again with no acknowledgement: insert `staff_flagged` (channel `phone`), set `escalation_level = 2`, `staff_flagged_at = now()`, `next_escalation_at = NULL`. The staff dashboard shows `staff_flagged_at IS NOT NULL` as red, meaning reception must phone the patient.
- Level 2 is final. Acknowledged, resolved and cancelled alerts are never touched.

Rows are selected with `FOR UPDATE OF a SKIP LOCKED` in one transaction, and the level only moves forward, so two instances never process the same alert and re-runs do nothing. `alert_events` is insert-only. The email never includes the clinical finding, only a request to sign in.

## Reminders

Appointments with `status = 'confirmed'`, `reminder_sent_at IS NULL`, whose slot starts (Asia/Kolkata) within the next `REMINDER_LEAD_HOURS`. Selected with `FOR UPDATE SKIP LOCKED`; after sending, `appointments.reminder_sent_at` is set so it is never sent twice. The email carries the scan type's `preparation_tips` and the active checklist questions for that scan type or modality. Selection rule: `src/jobs/reminderLogic.js`.

## Channels

`EmailChannel` (`src/channels/emailChannel.js`) uses nodemailer for `smtp` and a file for `log`. `SmsChannel` (`src/channels/smsChannel.js`) is a stub that only logs `sms.stub`; SMS is not implemented.

## Audit log (file system)

`src/lib/rotatingLog.js` is a hand-written rotating JSON-lines logger on `fs`. The active file is `logs/audit.log`. It rotates to `audit-YYYY-MM-DD.N.log` when the day changes or the size cap would be exceeded, and prunes beyond the newest `ALERTS_LOG_KEEP` archives.

## Docker

```bash
docker build -t diagnocare-alerts services/alerts
docker run --env-file .env -p 4000:4000 diagnocare-alerts
```
