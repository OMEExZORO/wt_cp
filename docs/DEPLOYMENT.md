# Deployment

## Architecture

```
Browser -> https://meghnaddiagnostics.me (Vercel, static SPA)
              |  /api/*  rewrite
              v
          https://diagnocare-api.onrender.com (Render free, Docker, PHP/Apache)
              |
              v
          Supabase (Postgres + storage bucket)

GitHub Actions (every 10 min) -> pings the API, then runs the alert jobs once against Supabase
```

The alerts service (`diagnocare-alerts`) is defined in `render.yaml` but is not kept awake. Its jobs run from GitHub Actions through `npm run jobs:once`.

## Vercel rewrite

`frontend/vercel.json` rewrites `/api/:path*` to the Render API before the SPA fallback, and the fallback regex excludes `/api/`. `frontend/public/_redirects` does the same for Cloudflare Pages.

Why: the browser only talks to `meghnaddiagnostics.me`, so the session cookie is first-party, `SameSite=Lax; Secure` works, Safari and privacy modes do not block it, and CSP stays at `connect-src 'self'`. Do not set `VITE_API_BASE_URL`; the frontend defaults to `/api/v1`.

The session cookie has no Domain attribute and `Path=/`, so it binds to the frontend host. `TRUST_PROXY=true` makes the API take the left-most `X-Forwarded-For` as the client IP for rate limiting.

## Render blueprint

1. Render dashboard: New, Blueprint, pick this repository, branch main.
2. Fill every variable marked `sync: false` (table below).
3. Apply. Both services use the free plan in Singapore.
4. Check `https://diagnocare-api.onrender.com/api/v1/health`.
5. The alerts service can be suspended in Render once the GitHub job is running; it is not needed for scheduled jobs.

## Environment variables

| Variable | Service | Source |
| --- | --- | --- |
| `APP_KEY`, `CSRF_SECRET` | API | generate random 32+ byte secrets |
| `ENCRYPTION_KEY`, `ENCRYPTION_KEYS_PREVIOUS` | API | generate; see README on rotation |
| `DATABASE_URL` or `DB_HOST/PORT/NAME/USER/PASSWORD/SSLMODE` | API, alerts, GitHub | Supabase connection details |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | API | Supabase project settings |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | API, alerts, GitHub | your SMTP provider (optional while `MAIL_DRIVER=log`) |
| `ALERTS_SERVICE_TOKEN` | alerts | generate |
| `FRONTEND_URL`, `APP_URL`, `CORS_ALLOWED_ORIGINS`, `SESSION_SAMESITE`, `SESSION_SECURE`, `TRUST_PROXY`, `MAIL_DRIVER` | API | set in `render.yaml` |
| `ALERT_ESCALATION_MINUTES`, `ALERTS_JOBS_ENABLED` | alerts | set in `render.yaml` |

GitHub repository secrets used by `alert-jobs`: `DATABASE_URL`, `ALERT_ESCALATION_MINUTES` (default 30), `MAIL_DRIVER` (default log), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `FRONTEND_URL`.

### Switching mail to SMTP

`MAIL_DRIVER` is `log` by default, so emails are written to the log instead of sent. To send real email, set `MAIL_DRIVER=smtp` on the API service, add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM`, and add the same values plus `MAIL_DRIVER=smtp` as GitHub secrets.

## Keep-alive design and free-tier math

Render free web services sleep after 15 minutes idle and the workspace gets 750 instance-hours per month. A 31-day month is 744 hours, so only one service can stay on. The API is that service; a cold start takes up to about a minute.

`.github/workflows/keepalive-and-jobs.yml` runs every 10 minutes:

- `keepalive` calls the API health endpoint directly (retrying up to about 90 seconds for a cold start) and through the Vercel rewrite.
- `alert-jobs` runs escalation and reminders once against the database, then exits. Both jobs time out at 5 minutes and runs do not overlap.

GitHub Actions minutes: public repositories are free. Private repositories get 2000 free minutes a month; a run every 10 minutes is about 4,300 minutes (each job bills at least one minute). If the repository goes private, change the cron to `*/30 * * * *` and use cron-job.org for the 10-minute keep-alive.

## Backup keep-alive with cron-job.org

1. Create a free account at cron-job.org.
2. Create a job with URL `https://diagnocare-api.onrender.com/api/v1/health`, schedule every 10 minutes, method GET, timeout 60 seconds.
3. Enable failure notifications.

## Verify

```bash
curl -i https://diagnocare-api.onrender.com/api/v1/health
curl -i https://meghnaddiagnostics.me/api/v1/health
```

Both should return 200. Then open https://meghnaddiagnostics.me, sign in, and confirm in browser dev tools that `dc_session` is set on `meghnaddiagnostics.me` with `Secure`, `HttpOnly`, `SameSite=Lax` and Path `/`, and that API calls go to `/api/v1/...` on the same origin. In GitHub, run the workflow manually (Actions, keepalive-and-jobs, Run workflow) and confirm both jobs pass.
