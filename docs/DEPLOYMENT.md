# Deployment

## Topology

```
Browser -> https://meghnaddiagnostics.me (Vercel, static SPA)
              |  /api/* rewrite
              v
          https://diagnocare-api.onrender.com (Render free plan, Docker, Node.js 22 / Express 5)
              |
              v
          Supabase (PostgreSQL + private storage bucket)

GitHub Actions (every 30 min) -> pings the API, then runs the alert jobs once against Supabase
```

The deployed API is the Node.js application in `api/`, built by `api/Dockerfile`. The PHP application in `backend/` is the reference implementation for the syllabus and for parity testing. It has its own Dockerfile and a `php` profile in `docker-compose.yml`, but `render.yaml` does not build it.

The alerts service (`diagnocare-alerts`) is also defined in `render.yaml`. Its jobs run from GitHub Actions through `npm run jobs:once`, so the Render service is not needed for scheduled work and can stay suspended.

## Vercel rewrite

`frontend/vercel.json` rewrites `/api/:path*` to the Render API before the SPA fallback, and the fallback pattern excludes `/api/`. `frontend/public/_redirects` does the same for Cloudflare Pages.

The browser only talks to `meghnaddiagnostics.me`, so the session cookie is first-party. `SameSite=Lax; Secure` works, Safari and privacy modes do not block it, and the content security policy can stay at `connect-src 'self'`. Leave `VITE_API_BASE_URL` unset; the frontend defaults to `/api/v1`.

The session cookie has no Domain attribute and `Path=/`, so it belongs to the frontend host. `TRUST_PROXY=true` makes the API use the left-most `X-Forwarded-For` address as the client IP for rate limiting.

## Render blueprint

1. In the Render dashboard choose New, Blueprint, pick this repository and the `main` branch.
2. Fill every variable marked `sync: false` (table below).
3. Apply. Both services use the free plan in Singapore.
4. Check `https://diagnocare-api.onrender.com/api/v1/health`.

The API container listens on `PORT=8080` and Render checks `/api/v1/health`. The container runs as the unprivileged `node` user. Sessions are stored in the `http_sessions` table (migration 020), so a restart or a second instance does not log users out.

## Database and storage

Run the migrations and base seed once from a machine that has PHP and Composer, with production values in `.env`:

```bash
npm run setup:php
npm run migrate
npm run seed
npm run storage:setup
```

Do not run `seed:dev` or `seed:demo` against production. The first admin account is created with the SQL in the README.

## Environment variables

| Variable | Service | Source |
| --- | --- | --- |
| `APP_KEY`, `CSRF_SECRET` | API | generate random 32 byte secrets |
| `ENCRYPTION_KEY`, `ENCRYPTION_KEYS_PREVIOUS` | API | generate; rotation is described in the README |
| `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE` | API, alerts, GitHub | Supabase connection details |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | API | Supabase project settings |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | API, alerts, GitHub | the SMTP provider (optional while `MAIL_DRIVER=log`) |
| `ALERTS_SERVICE_TOKEN` | alerts | generate |
| `PORT`, `APP_ENV`, `APP_DEBUG`, `APP_TIMEZONE`, `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `SESSION_SAMESITE`, `SESSION_SECURE`, `TRUST_PROXY`, `STORAGE_DRIVER`, `STORAGE_BUCKET`, `MAIL_DRIVER`, `ENCRYPTION_KEY_VERSION`, `ALERT_ESCALATION_MINUTES` | API | set in `render.yaml` |
| `REMINDER_LEAD_HOURS`, `JOB_INTERVAL_SECONDS`, `ALERTS_JOBS_ENABLED`, `ALERT_ESCALATION_MINUTES` | alerts | set in `render.yaml` |

Optional API variables with defaults: `SESSION_STORE` (`database`; `memory` for local runs), `SESSION_IDLE_MINUTES` (30), `SESSION_ABSOLUTE_HOURS` (12), `REMEMBER_DAYS` (30), `LOGIN_MAX_ATTEMPTS` (5), `LOGIN_LOCKOUT_MINUTES` (15), `MAX_BODY_BYTES`, `DB_POOL_MAX` (10), `LOG_PATH`.

`ALERT_ESCALATION_MINUTES` must have the same value on the API and the alert jobs, because the API sets `next_escalation_at` and the jobs read it.

GitHub repository secrets used by the scheduled workflow: `DATABASE_URL`, `ALERT_ESCALATION_MINUTES` (default 30), `MAIL_DRIVER` (default `log`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `FRONTEND_URL`.

### Switching mail to SMTP

`MAIL_DRIVER` is `log`, so emails are written to a log file instead of being sent. To send real email, set `MAIL_DRIVER=smtp` on the API service, add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM`, and add the same values plus `MAIL_DRIVER=smtp` as GitHub secrets so the scheduled alert job sends mail too.

## Keep-alive and free plan limits

Render free web services sleep after 15 idle minutes, and the workspace gets 750 instance-hours a month. A 31 day month has 744 hours, so only one service can stay on. The API is that service, and a cold start takes up to about a minute.

`.github/workflows/keepalive-and-jobs.yml` runs every 30 minutes as one job (`keepalive-and-alerts`, 5 minute timeout, runs do not overlap):

1. It calls the API health endpoint directly, retrying for about 90 seconds to cover a cold start, and then through the Vercel rewrite.
2. It installs `services/alerts` and runs `npm run jobs:once`, which executes the escalation and reminder jobs once against the database and exits.

Public repositories get free Actions minutes. A private repository gets 2000 minutes a month and this workflow uses about 1500.

A GitHub schedule every 30 minutes is longer than Render's 15 minute idle limit, so a second ping every 10 minutes keeps the API awake between runs. It is set up at cron-job.org:

1. Create a free account.
2. Add a job for `https://diagnocare-api.onrender.com/api/v1/health`, every 10 minutes, GET, timeout 60 seconds.
3. Turn on failure notifications.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`: the Node API tests (`api`), the PHPUnit tests (`backend`), the frontend tests and build (`web`) and the worker tests (`alerts`).

## Verify

```bash
curl -i https://diagnocare-api.onrender.com/api/v1/health
curl -i https://meghnaddiagnostics.me/api/v1/health
```

Both return 200. Then open https://meghnaddiagnostics.me, sign in, and confirm in the browser developer tools that `dc_session` is set on `meghnaddiagnostics.me` with `Secure`, `HttpOnly`, `SameSite=Lax` and Path `/`, and that API calls go to `/api/v1/...` on the same origin. In GitHub, run the workflow by hand (Actions, keepalive-and-jobs, Run workflow) and confirm it passes.

## Running the API in Docker locally

`docker compose up` starts the Node API on port 8000, the alerts worker on 4000 and the Vite dev server on 5173, using the root `.env`. `docker compose --profile php up api-php` starts the PHP reference API on port 8001, and `--profile localdb` adds a local Postgres.
