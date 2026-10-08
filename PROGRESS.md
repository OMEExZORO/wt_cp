# Progress

## Phases

- [x] 1. Repo scaffold, tooling, DB migrations and seed, env setup, scripts
- [ ] 2. PHP core: router, MVC base, Validator and Sanitizer, error handling, auth with sessions, cookies and remember-me, RBAC
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

## Next (Phase 2)

Router, Request, global exception handler, security headers, CORS, session handling, CSRF, Validator and Sanitizer, auth endpoints, remember-me, lockout, RBAC middleware. Follow `docs/CONVENTIONS.md`.
