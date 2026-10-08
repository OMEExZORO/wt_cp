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
