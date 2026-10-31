# Manual steps

Things that live outside the code: hosting accounts, secrets and content that only the centre can supply. Content values can be changed later from the admin panel (the `site_settings` and `branches` tables).

## Accounts and hosting

| Item | Where it is set |
|---|---|
| Render (API and alerts worker), Vercel or Cloudflare Pages (frontend), Supabase (database and storage) | Each provider's dashboard |
| Domain name and DNS for the frontend | Domain registrar and Vercel. The live site is `meghnaddiagnostics.me` |
| Production secrets: every variable marked `sync: false` in `render.yaml` | Render dashboard. Generation commands are in the README and in `docs/DEPLOYMENT.md` |
| Frontend build variables `SITE_URL` (and `VITE_API_BASE_URL` only if the API is on another origin) | Vercel project settings |
| GitHub Actions secrets for the scheduled alert job | Repository settings, see `docs/DEPLOYMENT.md` |
| SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) and `MAIL_DRIVER=smtp` | Render and GitHub secrets. Until they are set, email is written to a log file instead of being sent |
| First production admin user | SQL in the README (Deployment section) |
| Removing development data before use: the `*@diagnocare.test` users and demo reviews | `npm run seed:purge-demo` for reviews. A production database that was only ever seeded with `npm run seed` has none of them |
| Rotating the Supabase access token (`SUPABASE_ACCESS_TOKEN`) used during setup | Supabase account settings |

## Content supplied by the centre

| Item | Where it is set | State |
|---|---|---|
| Four branches with addresses and two phone numbers each | Migration `019_branches_official.sql`, editable in the admin Branches page | Loaded |
| Opening hours: Monday to Saturday 8 am to 10 pm, Sunday closed | Admin Slots page or `php backend/bin/generate-slots.php` | Slots are generated for these hours |
| Google reviews link | `site_settings`, migration 022 hides Google reviews from the public site | Set |
| Logo files `logo-lockup.png` and `logo-mdc.png` | `frontend/public/images/client/` | Added |
| WhatsApp number | `contact.whatsapp`, `branches.whatsapp`; shown when `SHOW_WHATSAPP` in `frontend/src/lib/features.ts` is true | Not supplied, hidden |
| Contact email | `contact.email`, `branches.email`; shown when `SHOW_EMAIL` in `frontend/src/lib/features.ts` is true | Not supplied, hidden |
| Exact Google Maps place link per branch | Admin Branches page | Branches use a Maps search link built from the address |
| Doctor photo and biography | Admin settings (`doctor.photo_url`, `doctor.bio`) and the doctor photo upload | Default biography from migration 022 |
| Fees | `fees.note`, `scan_types.fee_inr` | Not published |
| Review of service descriptions, preparation tips, checklist questions and FAQ answers | `database/seeds/seed_base.sql` | Written by the team from the centre's brochure; the doctor decides on changes |
| Privacy and Terms pages (3 year record retention, Bhosari phone as grievance contact, Pune jurisdiction) | `frontend/src/pages/public/` | Written by the team, no legal review |
