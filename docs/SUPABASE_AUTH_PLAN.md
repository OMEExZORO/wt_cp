# Supabase Auth Migration Plan

Status: design only. Nothing in `api/`, `backend/` or `frontend/` has been changed. Written 2026-10-16.

## 1. Decision summary

Move credential storage and token issuing to Supabase Auth (GoTrue) behind our own Node API (backend-for-frontend). The browser never talks to Supabase. The React app keeps calling `/auth/*` with the same JSON and the same CSRF header. The `users` table stays as the application profile and role table. The PHP `backend/` stays untouched and keeps demonstrating PHP sessions, cookies, `password_hash` and CSRF for the syllabus.

Recommended hybrid (least change, least risk):

- Supabase owns: password verification, password hashes, refresh tokens, session revocation, JWT signing.
- Our API owns: lockout and `login_attempts`, rate limits, roles, `is_active`, audit log, CSRF, e-mail sending (our templates and mailer), e-mail verification tokens, cookies.
- Supabase mailer is not used (users are created with `email_confirm: true`), so Supabase SMTP limits do not apply.

## 2. Verified facts and sources

| Fact | Certainty | Source |
|---|---|---|
| Supabase supports bcrypt and Argon2 hashes for imported users, stored in `auth.users.encrypted_password` | High (doc statement) | https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0 |
| Admin create user accepts `password_hash` (and `id`); sending both `password` and `password_hash` returns 400; hash stored as supplied; plaintext strength policy applies only to plaintext | High (source code `internal/api/admin.go`) | https://raw.githubusercontent.com/supabase/auth/master/internal/api/admin.go , PR supabase/auth#1641 |
| The JS reference page for `createUser` does not list `password_hash`; the field is real but sparsely documented | High | https://supabase.com/docs/reference/javascript/auth-admin-createuser |
| Argon2 verification: prefix `$argon2`, algorithms argon2i and argon2id only, version must be 19, m <= 1 GiB, t <= 20, p <= 16, `data`/`keyid` rejected. Our PHC string `$argon2id$v=19$m=65536,t=4,p=1$salt$hash` (PHP 8.3 and our Node hasher output) fits | High (source `internal/crypto/password.go`, plus a PHP-generated sample inspected locally) | https://raw.githubusercontent.com/supabase/auth/master/internal/crypto/password.go |
| New hashes (password set or changed through Supabase) are always bcrypt | High | same file |
| No rehash-to-bcrypt on login was found in `token.go` (only re-encryption on key change); argon2id hashes stay as imported until the user changes the password. Not read: `models.User.Authenticate` | Medium | https://raw.githubusercontent.com/supabase/auth/master/internal/api/token.go |
| Bad credentials: HTTP 400 `invalid_credentials` "Invalid login credentials"; unconfirmed: 400 `email_not_confirmed` | High | token.go |
| Built-in e-mail provider: only org team members, 2 e-mails per hour, no SLA. After saving custom SMTP the limit starts at 30 per hour and is adjustable | High | https://supabase.com/docs/guides/auth/auth-smtp , https://supabase.com/docs/guides/auth/rate-limits |
| `/token` limit: 150 per 5 minutes per IP, burst 30, configurable. Sign-up/sign-in/recover/resend: 30 per 5 min per IP. Password reset: 1 per 60 s per user. Verify: 30 per 5 min per IP. 429 on excess | High | https://supabase.com/docs/guides/auth/rate-limits |
| Real client IP can be forwarded with header `Sb-Forwarded-For` when IP forwarding is enabled and a secret API key is used | Medium (doc note, exact dashboard toggle name unverified) | same page |
| `signOut` scope `global` (default) ends all sessions of the user, `local` current only, `others` all but current. Issued access tokens cannot be revoked until expiry | High | https://supabase.com/docs/reference/javascript/auth-signout |
| Sign-out deletes the row in `auth.sessions`; validate by checking the JWT `session_id` claim against `auth.sessions` | High | https://supabase.com/docs/guides/auth/sessions |
| Refresh token reuse window 10 s by default; reuse outside it revokes the whole session | High | same page |
| Time-box, inactivity timeout and single-session-per-user need Pro plan or above | High | same page |
| JWKS at `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`, returns keys only when asymmetric signing keys are in use; cache at most about 10 minutes; for HS256 shared secret Supabase recommends calling `GET /auth/v1/user` instead of verifying locally | High | https://supabase.com/docs/guides/auth/jwts |
| New API keys: publishable `sb_publishable_...` (replaces anon) and secret `sb_secret_...` (replaces service_role), sent in the `apikey` header, not as Bearer. Legacy anon/service_role JWTs still work until disabled; deprecation planned end of 2026 | High | https://supabase.com/docs/guides/api/api-keys |
| Keys: Dashboard > Settings > API Keys; URL: Connect dialog; format `https://<project-ref>.supabase.co`. Our ref is `mcdimpugvdrzvxvfkwfo` (from project memory), so `SUPABASE_URL=https://mcdimpugvdrzvxvfkwfo.supabase.co` | High for format, medium for ref (memory is 7 days old) | same page |
| Email template variables: `ConfirmationURL`, `Token`, `TokenHash`, `SiteURL`, `RedirectTo`, `Data`. Server-side pattern: link carries `token_hash` and `type`, server calls verify | High | https://supabase.com/docs/guides/auth/auth-email-templates |
| Site URL and Redirect URLs allow list; `*` does not cross `/` or `.`, `**` does | High | https://supabase.com/docs/guides/auth/redirect-urls |
| Email confirmation before sign-in is on by default on hosted projects. `resetPasswordForEmail` never reveals whether the account exists | High | https://supabase.com/docs/guides/auth/passwords |
| Hash import end-to-end test with a throwaway user | NOT RUN. Neither `api/.env` nor `backend/.env` exists in the repo (only `backend/.env.example` with DB_* keys), so no Supabase URL or secret key was available | Blocked |

Open points to confirm during the pilot (Phase 0): that `Authenticate` accepts the PHP argon2id string at sign-in, that the `id` field is honoured on create, and the exact name of the IP forwarding toggle.

## 3. Architecture

```
Browser (React, unchanged)
   |  fetch /auth/*  (credentials: include, header X-CSRF-Token)
   v
Cloudflare Worker or Render Node API  ("BFF")
   |  middleware: cors -> start-session (dc_session, CSRF seed) -> csrf -> authenticate -> role/verified
   |  services:  AuthService (lockout, audit, login_attempts, rate limits)
   |             SupabaseAuthClient (fetch only, no hashing)
   |             JwtVerifier (jose + remote JWKS, 10 min cache)
   |             Mailer (existing templates, MAIL_DRIVER)
   |
   +--> Postgres (diagnocare_app role)  users, patients, login_attempts, audit_log, rate_limits,
   |                                    http_sessions (CSRF seed only), email_verifications
   |
   +--> Supabase Auth  https://<ref>.supabase.co/auth/v1
            POST /token?grant_type=password        (apikey: publishable)
            POST /token?grant_type=refresh_token   (apikey: publishable)
            POST /logout?scope=global|local        (Bearer: user access token)
            GET  /.well-known/jwks.json
            POST /admin/users, PUT /admin/users/{id}, POST /admin/generate_link
                                                   (apikey: secret key)
```

### Cookies and sessions

Keep `dc_session` exactly as today: an opaque id with the row in `http_sessions`. It carries the CSRF seed and, after login, a server-side reference to the Supabase session. The Supabase refresh token is stored inside `http_sessions.data` (server side, never sent to the browser), together with `sb_session_id`, `user_id`, `role`, `auth_time`. Benefits: the browser sees the same single HttpOnly cookie, CSRF code is unchanged, idle and absolute timeouts are unchanged, nothing large sits in cookies, and the PHP-demonstrable cookie/session design remains the story.

Per request, `resolveUser` does:

1. Load `dc_session`. If it holds `sb_access_token` whose `exp` is more than 30 s away, verify signature and claims through JWKS (no network after first fetch), take `sub`.
2. If the access token is near expiry, call `/token?grant_type=refresh_token` with the stored refresh token, store the new pair, continue. If refresh fails, clear the session auth.
3. Load `users` by `auth_id = sub`, apply the existing checks (`is_active`, role unchanged, `password_changed_at` newer than `auth_time` invalidates).
4. Remember-me: keep the existing `remember_tokens` flow, or simply issue a longer `dc_session` lifetime when `remember` is true and store the refresh token for that long. Recommended: drop `remember_tokens` for Supabase users and extend the session absolute lifetime (30 days) because Supabase refresh tokens already provide the long-lived credential. The cookie `dc_remember` is cleared on logout for old sessions.

Immediate revocation caveat: access JWTs cannot be revoked. Keep JWT expiry at 5 to 10 minutes (dashboard minimum recommended 5) and, because we always route through the refresh step, "log out everywhere" takes effect at the next refresh at the latest, and immediately for our own `dc_session` rows (we delete all `http_sessions` rows of that user by `user_id`, which needs an indexed `user_id` extracted column, see migration below).

## 4. Data mapping and schema changes

`users` stays. Proposed migration `023_supabase_auth_link.sql`, run with the owner role (`DB_MIGRATE_PORT`), not as `diagnocare_app`:

- `ALTER TABLE users ADD COLUMN auth_id uuid UNIQUE;`
- Backfill `UPDATE users SET auth_id = id` (we create Supabase users with the same UUID, so all existing foreign keys keep working and no remapping of `patients.user_id` and so on is needed).
- Optional FK `users.auth_id REFERENCES auth.users(id)`: this needs the migrating role to have `REFERENCES` on `auth.users`. The `postgres` role (migration port) has it; `diagnocare_app` does not need it because FKs are checked by the table owner path. If the grant is awkward, skip the FK and rely on the sync script plus a nightly consistency check query.
- `users.password_hash` becomes nullable and unused after cutover (keep for rollback until Phase 6, then null it out).
- `http_sessions`: add `user_id uuid` (nullable, indexed) and `sb_session_id uuid` so "log out everywhere" can delete our rows. `remember_tokens`, `password_resets` become unused (kept for PHP backend and rollback).
- Keep `login_attempts`, `failed_login_count`, `locked_until`, `last_login_at`, `email_verified_at`, `email_verifications`, `audit_log` unchanged.
- Role: also write `app_metadata.role` and `app_metadata.user_id` when creating the Supabase user, informational only. Authorization always reads `users.role` from our DB (single source of truth, no JWT-embedded role drift).

### RLS and DB role interaction

- Migration 010 enables RLS on all `public` tables and revokes `anon`/`authenticated` privileges. `diagnocare_app` has BYPASSRLS, so the API is unaffected.
- Supabase Auth data lives in the `auth` schema, owned by `supabase_auth_admin`. `diagnocare_app` has no grants on `auth` and must not get any: the API talks to GoTrue over HTTPS only. Nothing in `public` should ever expose `auth.users`.
- Because we never use PostgREST with user JWTs, `authenticated` stays locked out of `public`. If a Supabase auth-hook or trigger on `auth.users` is added later, put it in a dedicated function with `SECURITY DEFINER` and no direct table grants.
- Supabase Storage already uses a server key (`api/src/services/storage/supabase-storage.js`); the same secret key is reused for the admin API.

## 5. Endpoint mapping

Wire contract (paths, JSON bodies, status codes, error envelope `{data, error:{code,message}}`, `X-CSRF-Token`) is unchanged.

| Our endpoint | Today | After migration (Supabase calls) |
|---|---|---|
| `GET /auth/csrf` | CSRF seed in `http_sessions` | Unchanged |
| `POST /auth/register` | validate, hash with argon2id, insert `users` + profile in tx, send verify mail, start session | Validate. Insert `users` + profile in tx (no hash). `POST /auth/v1/admin/users` `{id, email, password, email_confirm: true, app_metadata}` (plaintext password, GoTrue hashes bcrypt; Worker does no hashing). If Supabase call fails, roll back the tx (create Supabase user first, then DB tx, and delete the Supabase user on DB failure). Then `POST /token?grant_type=password` to obtain tokens and start session. Our own verification mail unchanged (`email_verified_at` stays null until link used). Duplicate email check stays in our DB first, plus map GoTrue `email_exists` to the same 409 |
| `POST /auth/login` | lockout check, argon2 verify, rehash, session | Keep lockout, `login_attempts`, audit and generic error. Replace `verifyPassword` with `POST /token?grant_type=password` (header `Sb-Forwarded-For: <req.ip>`). 400 `invalid_credentials` becomes our existing `AuthenticationError`; 429 becomes `RateLimitError`. Dummy-hash timing trick no longer needed. Remember-me per section 3 |
| `POST /auth/logout` | destroy session, forget remember cookie | `POST /logout?scope=local` with the stored access token (ignore failure), delete `http_sessions` row, clear cookie, audit |
| `DELETE /auth/sessions` (log out everywhere) | revoke remember tokens, destroy session | `POST /logout?scope=global` (refresh first if token expired), delete all `http_sessions` rows with this `user_id`, clear cookies, audit with count |
| `GET /auth/me` | session user | Unchanged shape; user resolved by section 3 flow |
| `PATCH /auth/me` | update `users` and profile | Unchanged (name and phone are not in Supabase). Optional: mirror into `user_metadata` |
| `POST /auth/password/forgot` | token in `password_resets`, mail | Keep rate limits and neutral response. Call `POST /admin/generate_link` `{type: "recovery", email}` with the secret key; use returned `hashed_token` in our own mail: `${FRONTEND_URL}/reset-password?token=<hashed_token>`. Existing React page and "email_found" audit unchanged. Supabase mailer and its 1-per-minute-per-user limit are bypassed |
| `POST /auth/password/reset` | consume token, set hash, revoke remember | `POST /verify` `{type: "recovery", token_hash}` returns a session; then `PUT /admin/users/{id}` `{password}` (or `PUT /user` with that access token), then `POST /logout?scope=global`; set `users.password_changed_at`, clear lockout fields, send "password changed" mail, audit |
| `PUT /auth/password` | verify current, set new, refresh auth_time | Verify current via `POST /token` (grant password) without creating a visible session (discard tokens, or use them to build the new session); then `PUT /admin/users/{id}` `{password}`; `logout?scope=others`; new `dc_session` regenerate; update `password_changed_at`; mail; audit. Alternative once supabase-js 2.102 style `current_password` is available over REST: not needed |
| `POST /auth/email/verify` | consume our token, set `email_verified_at` | Unchanged (our table). Optionally also `PUT /admin/users/{id}` `{email_confirm: true}`; not required because users are created confirmed |
| `POST /auth/email/resend` | issue new token, mail | Unchanged |

Admin user management in the API (admin creating staff, activating, deactivating): create staff with `admin/users` (same pattern as register); deactivate sets `users.is_active=false` and also `PUT /admin/users/{id}` `{ban_duration: "876000h"}` plus global sign-out; reactivate sets `ban_duration: "none"`.

Account lockout is intentionally kept outside Supabase (GoTrue has no per-account lockout, only per-IP rate limits). Because every request reaches GoTrue from our server IP, the per-IP `/token` limit (150 per 5 min) would otherwise be shared by all users: enable IP forwarding and send `Sb-Forwarded-For`, and raise the `/token` limit in the dashboard (Authentication > Rate Limits).

## 6. E-mail, branding and domain

- Default plan uses our existing `MAIL_DRIVER` mailer and templates, so branding for `meghnaddiagnostics.me` is unchanged. Supabase never sends mail in this design.
- If the owner later wants Supabase to send (invite, reauthentication, security notifications): configure custom SMTP (Authentication > Emails > SMTP Settings, sender `no-reply@meghnaddiagnostics.me`, provider such as Resend, Brevo or SES; domain needs SPF, DKIM, DMARC DNS records), raise the e-mail rate limit, and edit templates under Authentication > Emails > Templates using `{{ .SiteURL }}`, `{{ .TokenHash }}`, `{{ .RedirectTo }}`.
- Site URL = `https://meghnaddiagnostics.me`. Redirect allow list: exact production paths `https://meghnaddiagnostics.me/reset-password`, `https://meghnaddiagnostics.me/verify-email`, plus `http://localhost:5173/**` for development only. Because our flow sends links to the SPA with our own token, these only matter for `generate_link` (it validates `redirect_to` against the list; pass the SPA URL).

## 7. Existing users: migration

Script outline (`scripts/migrate-users-to-supabase.mjs`, Node, run from a trusted machine, not on the Worker):

1. Preconditions: dev rehearsal passed; maintenance window or read-only mode for registrations; backup with `pg_dump` of `users`; export CSV of `id,email,password_hash` kept offline.
2. Select users where `auth_id IS NULL AND password_hash LIKE '$argon2id$%'`. Rows with other prefixes (bcrypt `$2y$`) are also accepted by GoTrue; anything else is reported and handled by a forced reset.
3. For each user (concurrency 5, retry on 429 with backoff): `POST /auth/v1/admin/users` with `{id: users.id, email, password_hash, email_confirm: true, app_metadata: {role, user_id}, user_metadata: {full_name}}`. Never send `password` together with `password_hash`.
4. On 201 set `users.auth_id = id`. On `email_exists` or `id` conflict, log and look up the user via `GET /admin/users?...` to reconcile instead of failing.
5. Users with `is_active=false` get `ban_duration` set after import.
6. Verification query: count of `users` equals count of `auth.users` imported (Dashboard SQL editor: `select count(*) from auth.users`); sample 3 non-production-critical accounts by logging in with a known test password.
7. Order: (a) deploy migration 023 and the new code behind flag `AUTH_DRIVER=supabase` default `local`; (b) run import in dev, test; (c) run import in prod while flag is `local` (users can still log in the old way); (d) flip `AUTH_DRIVER=supabase`; (e) monitor audit log and 4xx rates; (f) after 14 days null out `users.password_hash`.
8. Passwords changed after step (c) but before (d) would be lost: freeze password changes during the window or re-run the script in "update" mode (`PUT /admin/users/{id}` with `password_hash`) for users whose `password_changed_at` is newer than the import time.
9. Rollback: flag back to `local` (old code and `password_hash` still intact). Users who changed their password while on Supabase would have an out-of-date local hash: keep a dual-write for the window (also write argon2id hash to `users.password_hash` on password change, using the existing Node hasher, which is acceptable on Render but not on Workers) or force a reset for those users (`password_changed_at > cutover`). Supabase users can be bulk-deleted with the admin API by `auth_id` list; the script supports `--rollback`.

Note on hash quality: imported users keep argon2id until they change their password, after which GoTrue stores bcrypt (verified in source). Both are acceptable; document this in `SECURITY.md`.

## 8. Dashboard configuration (owner clicks)

1. Project Settings > API Keys: create or copy the publishable key and create a secret key (`sb_secret_...`). Copy the Project URL from the Connect dialog.
2. Authentication > Sign In / Providers > Email: enable provider; leave "Confirm email" on is fine (we create confirmed users); disable "Allow new users to sign up" (public signups through `/auth/v1/signup` must be impossible, only our API creates users via admin API).
3. Authentication > Sign In / Providers > Password settings: minimum length 8 (match `ACCOUNT_RULES` password rule); optionally leaked-password protection (Pro).
4. Authentication > Sessions (Pro): time-box 30 days, inactivity timeout 7 days, optional single session per user = off.
5. Project Settings > JWT Keys (or JWT Signing Keys): migrate to asymmetric keys (ES256 or RS256) so JWKS is populated; access token expiry 600 seconds (Authentication > Sessions or JWT settings).
6. Authentication > URL Configuration: Site URL `https://meghnaddiagnostics.me`; add redirect URLs listed in section 6.
7. Authentication > Rate Limits: raise "Rate limit for token refreshes and sign-ins" (e.g. 1000 per 5 min) because traffic is aggregated by our server IP unless IP forwarding is enabled; enable IP forwarding if the setting is present in this project's API settings.
8. Authentication > Emails (only if Supabase sends mail later): SMTP settings and templates as in section 6.
9. Authentication > Attack Protection: CAPTCHA optional; keep disabled while the BFF is the only client.
10. Database > Roles: confirm `diagnocare_app` has no grants on schema `auth`.

## 9. Environment variables

API (Render and local `api/.env`; Cloudflare Worker secrets via `wrangler secret put`):

| Name | Value | Where |
|---|---|---|
| `AUTH_DRIVER` | `local` or `supabase` | Render, Workers |
| `SUPABASE_URL` | `https://mcdimpugvdrzvxvfkwfo.supabase.co` | Render, Workers, GitHub variable |
| `SUPABASE_PUBLISHABLE_KEY` | publishable key (or legacy anon) | Render, Workers |
| `SUPABASE_SECRET_KEY` | secret key (or legacy service_role); already needed by storage under whatever name it uses today, reuse it | Render, Workers (secret), GitHub secret for CI migration jobs |
| `SUPABASE_JWKS_URL` | `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (optional, derived) | Render, Workers |
| `SUPABASE_JWT_ISSUER` | `${SUPABASE_URL}/auth/v1` (optional, derived) | Render, Workers |
| `SUPABASE_FORWARD_IP` | `true` | Render, Workers |
| `SESSION_ABSOLUTE_HOURS` | raise to 720 if remember-me is folded into sessions | Render, Workers |

GitHub Actions: secrets `SUPABASE_URL`, `SUPABASE_SECRET_KEY` only if a CI job runs the import or integration tests; use a separate dev project for CI.
Cloudflare: nothing new on the Pages side; the SPA never receives Supabase keys.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Hash import not confirmed end to end (no keys available) | High | Phase 0 pilot with one throwaway user in dev before anything else |
| Shared server IP hits `/token` limit | Login outages | IP forwarding plus raised limits; our own throttle stays in front |
| Access tokens not revocable | Delay up to JWT expiry | 5 to 10 min expiry, our `http_sessions` deletion, refresh gate |
| GoTrue has no account lockout | Brute force | Keep `login_attempts` lockout in the BFF |
| Two sources of truth (users and auth.users) drift | Orphans, login failures | Create Supabase user first with the same UUID, reconcile job, nightly count check |
| Vendor outage blocks login | Downtime | Accepted; `AUTH_DRIVER=local` rollback while hashes retained |
| Public signup endpoint of GoTrue reachable with the publishable key | Account creation bypassing consent and profile rows | Disable signups in dashboard (step 8.2) |
| Syllabus evidence lost | Marks | PHP `backend/` unchanged; Node keeps `AUTH_DRIVER=local` path and its tests; add a short "why we moved" note to `SYLLABUS_MAPPING.md` |
| Refresh token rotation race on parallel requests | Spurious logouts | Serialize refresh per session (compare-and-set on `http_sessions`), 10 s reuse window helps |
| Password change after import loses hash on rollback | Locked-out users | Dual-write window or forced reset |
| Supabase API key renaming (legacy keys deprecated end of 2026) | Breakage | Use new publishable/secret keys from the start |

## 11. Test plan

- Unit: `SupabaseAuthClient` against a fake `fetch` (success, 400 invalid credentials, 429, network error); `JwtVerifier` with a locally generated JWKS (valid, expired, wrong issuer, wrong audience, unknown kid, tampered).
- Integration (dev Supabase project, nightly, not on every PR): register, login, `/me`, logout, global logout from two clients, forgot and reset flow with token from `generate_link`, password change, deactivated user rejected, ban applied.
- Migration rehearsal: import 5 synthetic users with PHP-generated and Node-generated argon2id and one bcrypt hash; log in with each; delete afterward; run script twice for idempotency; run `--rollback`.
- Regression: the existing `api/test` suite for auth runs under both `AUTH_DRIVER` values; wire contract snapshot tests compare responses byte for byte except ids and timestamps; frontend Playwright or manual smoke of Login, Register, Verify email, Forgot, Reset, Change password.
- Security: CSRF required on all mutating `/auth` calls; cookie flags (HttpOnly, Secure, SameSite=None in production); lockout after N failures with Supabase driver; timing equality for unknown vs known email; confirm no Supabase key reaches the browser bundle; confirm `/auth/v1/signup` rejects public calls.
- Load: 100 logins per minute from one IP to confirm no 429 with forwarding.

## 12. Work breakdown (parallelizable)

| # | Task | Depends on | Size |
|---|---|---|---|
| T0 | Owner: create keys, dashboard settings (section 8), provide dev keys | none | 1 h owner |
| T1 | Pilot: throwaway user with PHP hash, sign in, delete (confirms facts) | T0 | 1 h |
| T2 | `SupabaseAuthClient` (fetch wrapper, error mapping, IP forwarding) plus unit tests | none | 0.5 day |
| T3 | `JwtVerifier` with JWKS cache (jose) plus unit tests | none | 0.5 day |
| T4 | Migration 023 and model changes (`auth_id`, `http_sessions.user_id`) | none | 0.5 day |
| T5 | `AuthService` driver split: login, logout, logout-everywhere, resolveUser/refresh | T2, T3, T4 | 1 day |
| T6 | Registration and admin-created users via admin API with compensation | T2, T4 | 0.5 day |
| T7 | Password forgot/reset/change via generate_link, verify, admin update | T2, T4 | 1 day |
| T8 | Import script, rollback and reconciliation job | T2, T4 | 0.5 day |
| T9 | Config and env wiring for Render and Workers, `.env.example`, `DEPLOYMENT.md`, `SECURITY.md`, `SYLLABUS_MAPPING.md` notes | none | 0.5 day |
| T10 | Test suites: unit, integration, contract snapshots | T5 to T8 | 1 day |
| T11 | Production rehearsal, cutover, monitoring | all | 0.5 day |

T2, T3, T4, T9 start in parallel; then T5, T6, T7, T8 in parallel; then T10 and T11. About 6 to 7 agent-days total, about 3 calendar days with four parallel agents.
