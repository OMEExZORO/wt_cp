# Architecture

DiagnoCare has three runtime parts and one database: a React single page app, a plain PHP REST API, a Node.js worker for time-based jobs, and Supabase (PostgreSQL plus private object storage).

## System overview

```mermaid
flowchart LR
    Browser["Browser<br/>React 18 SPA (Vite, Redux Toolkit)"]
    subgraph Static["Static hosting (Vercel or Cloudflare Pages)"]
        Spa["dist/ + SPA rewrite + security headers"]
    end
    subgraph Api["PHP 8.3 API (Apache, Docker, Render)"]
        Mw["Middleware pipeline<br/>CORS, headers, session, CSRF, auth, RBAC, throttle"]
        Ctl["Controllers"]
        Svc["Services<br/>booking, reports, alerts, auth, encryption, mail"]
        Mdl["Models (PDO prepared statements)"]
        Mw --> Ctl --> Svc --> Mdl
    end
    subgraph Worker["Node.js alerts worker (Express, Render)"]
        Sched["Scheduler<br/>escalation + reminders"]
        Status["Status page + REST"]
        Log["Rotating audit log"]
    end
    subgraph Supabase["Supabase"]
        Pg[("PostgreSQL<br/>RLS on, no public grants")]
        Store[("Private Storage bucket<br/>encrypted report files")]
    end
    Smtp["SMTP provider"]

    Browser -->|"HTML, JS, CSS"| Spa
    Browser -->|"JSON over HTTPS + cookies + X-CSRF-Token"| Mw
    Mdl --> Pg
    Svc -->|"encrypted bytes (service key)"| Store
    Svc -->|"verification, reset, alerts"| Smtp
    Sched -->|"pg pool"| Pg
    Sched -->|"nodemailer"| Smtp
    Sched --> Log
    Status --- Sched
```

Key points:

- The browser only ever talks to the static host and the PHP API. It never receives Supabase keys.
- Only the PHP API and the worker connect to the database, with the `diagnocare_app` role. Row Level Security with no policies blocks every other path.
- Report files are encrypted by PHP (AES-256-GCM) before they reach Storage.
- PHP creates a critical alert and sets `next_escalation_at`; the worker watches the table and escalates. They share `ALERT_ESCALATION_MINUTES`.

## Layers in the API

| Layer | Directory | Role |
|---|---|---|
| Front controller | `backend/public/index.php` | Loads config, registers the error handler, runs the kernel |
| Core | `backend/src/Core` | Router, Kernel, middleware Pipeline, Container, Session, Cookie, Csrf, Database |
| Middleware | `backend/src/Middleware` | Cross-cutting rules applied before controllers |
| Controllers | `backend/src/Controllers` | Parse input, call services, return `Response` |
| Services | `backend/src/Services` | Business rules (booking transaction, report storage, alert workflow) |
| Models | `backend/src/Models` | One class per table family; all SQL lives here |
| Validation | `backend/src/Validation` | `Validator`, `Sanitizer`, `RequestValidator` |

## Request lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant P as public/index.php
    participant K as Kernel + Pipeline
    participant C as Controller
    participant S as Service
    participant M as Model (PDO)
    participant D as PostgreSQL

    B->>P: POST /api/v1/appointments (cookie, X-CSRF-Token, JSON)
    P->>K: Request::fromGlobals
    K->>K: ErrorHandler wraps everything (JSON errors)
    K->>K: CORS (allowlist, preflight)
    K->>K: MatchRoute (404 or 405 before any session)
    K->>K: SecurityHeaders
    K->>K: StartSession (idle and absolute timeout)
    K->>K: Csrf (unsafe methods only)
    K->>K: RequireAuth, Role, Verified, RateLimit
    K->>C: AppointmentController::store
    C->>C: RequestValidator (Validator + Sanitizer, threats audited)
    C->>S: BookingService::book
    S->>M: transaction, SELECT slot FOR UPDATE
    M->>D: prepared statements
    D-->>M: rows
    S-->>C: appointment id
    C-->>K: Response (envelope { data, error })
    K-->>B: JSON + security headers
```

Every response uses one envelope: `{ "data": ..., "error": null }` on success and `{ "data": null, "error": { "code", "message", "fields?" } }` on failure.

## Data model

Main tables (columns trimmed to keys and the fields that matter for the design). All entity ids are UUIDs; `alert_events`, `audit_log` and `report_access_log` are append-only logs.

```mermaid
erDiagram
    users ||--o| patients : "profile (nullable for walk-ins)"
    users ||--o| referrers : "profile"
    users ||--o{ remember_tokens : "has"
    users ||--o{ password_resets : "has"
    users ||--o{ email_verifications : "has"
    branches ||--o{ slots : "offers"
    scan_categories ||--o{ scan_categories : "parent"
    scan_categories ||--o{ scan_types : "groups"
    scan_types ||--o{ checklist_items : "has"
    patients ||--o{ appointments : "books"
    slots ||--o{ appointments : "holds"
    scan_types ||--o{ appointments : "for"
    branches ||--o{ appointments : "at"
    referrers ||--o{ referrals : "creates"
    referrals ||--o{ appointments : "linked to"
    appointments ||--o{ appointment_checklist_answers : "answers"
    checklist_items ||--o{ appointment_checklist_answers : "question"
    appointments ||--o{ reports : "produces"
    patients ||--o{ reports : "owns"
    reports ||--o{ report_access_log : "view, download, denied"
    reports ||--o{ critical_alerts : "flagged"
    patients ||--o{ critical_alerts : "notified"
    critical_alerts ||--o{ alert_events : "immutable trail"
    appointments ||--o| reviews : "one per visit"
    users ||--o{ audit_log : "actor"

    users {
        uuid id PK
        text email UK
        text password_hash
        text role
        int failed_login_count
        timestamptz locked_until
        timestamptz password_changed_at
    }
    patients {
        uuid id PK
        uuid user_id FK
        text full_name
    }
    slots {
        uuid id PK
        uuid branch_id FK
        text modality
        date slot_date
        time start_time
        int capacity
        int booked_count
        bool is_blocked
    }
    appointments {
        uuid id PK
        uuid patient_id FK
        uuid slot_id FK
        uuid scan_type_id FK
        uuid referral_id FK
        text reference_code UK
        text status
        text urgency
        timestamptz completed_at
    }
    reports {
        uuid id PK
        uuid appointment_id FK
        uuid patient_id FK
        text storage_path
        text encryption_iv "per-file random IV"
        text encryption_tag "GCM auth tag"
        int key_version
        text findings_encrypted
        text impression_encrypted
        text status
        bool is_critical
    }
    critical_alerts {
        uuid id PK
        uuid report_id FK
        text status
        int escalation_level
        timestamptz next_escalation_at
        timestamptz acknowledged_at
    }
    alert_events {
        bigint id PK
        uuid alert_id FK
        text event_type
        text actor_type
        text channel
        timestamptz created_at
    }
```

Rules enforced in the schema (`database/migrations/`):

- One non-cancelled appointment per patient per slot (partial unique index in `005_scheduling.sql`).
- `slots.booked_count <= capacity` check; capacity is also guarded in code by row locks.
- `alert_events` cannot be updated, deleted or truncated (triggers in `007_alerts.sql`).
- Every table has Row Level Security enabled and no policies; `anon` and `authenticated` have no grants (`010_lock_down_public_roles.sql`).
- One review per appointment (`reviews.appointment_id` unique).
- Other tables not drawn: `branches`, `faqs`, `site_settings`, `login_attempts`, `rate_limits`, `audit_log`, `schema_migrations`.

## Critical alert flow

```mermaid
sequenceDiagram
    autonumber
    participant Dr as Doctor (SPA)
    participant API as PHP API
    participant DB as PostgreSQL
    participant W as Node worker
    participant Mail as SMTP
    participant Pt as Patient / Referrer
    participant Rx as Reception

    Dr->>API: POST /reports/{id}/critical (+ optional note)
    API->>DB: BEGIN, lock report, insert critical_alerts + alert_events(raised)
    API->>DB: note encrypted (AES-256-GCM), COMMIT
    API->>Mail: email patient and linked referrer (no findings in text)
    API->>DB: alert_events(notified), next_escalation_at = now + window
    Pt->>API: GET /alerts/mine (banner, polled every 60 s)
    alt acknowledged in time
        Pt->>API: POST /alerts/{id}/acknowledge
        API->>DB: alert_events(acknowledged), status = acknowledged
    else window expires
        loop every JOB_INTERVAL_SECONDS
            W->>DB: select due, unacknowledged alerts
        end
        W->>Mail: level 0 due: resend notification
        W->>DB: alert_events(resent, escalated), status = escalated, escalation_level = 1, new window
        W->>DB: level 1 due and still unacknowledged: alert_events(staff_flagged), level 2
        Note over W,DB: the alert is now red on the staff board
        Rx->>API: GET /alerts (red flag), phone the patient
        Rx->>API: PATCH /alerts/{id}/resolve (note)
        API->>DB: alert_events(resolved)
    end
```

Every state change is a row in `alert_events`, so the full timeline can be shown to staff via `GET /alerts/{id}/events`. SMS exists as a documented stub (`backend/src/Services/Alerts/SmsGateway.php`, `services/alerts/src/channels/smsChannel.js`).

## Frontend structure

- Routing: `frontend/src/App.tsx` (lazy pages, public, auth, portal and admin trees).
- State: one Redux Toolkit store (`app/store.ts`) with `auth`, `booking`, `alerts` and `public` slices; local component state for UI-only concerns; Context only for the theme.
- API layer: `api/client.ts` adds the CSRF token, parses the envelope and throws `ApiError`; `hooks/useApi.ts` exposes loading and error state.
- Guards: `ProtectedRoute` and `GuestRoute` choose the destination from `lib/roles.ts`.

## Deployment topology

| Part | Host | Config |
|---|---|---|
| SPA | Vercel or Cloudflare Pages | `frontend/vercel.json`, `frontend/public/_redirects`, `frontend/public/_headers` |
| API | Render web service (Docker) | `backend/Dockerfile`, `render.yaml` |
| Worker | Render web service (Docker) | `services/alerts/Dockerfile`, `render.yaml` |
| Database and bucket | Supabase | `database/migrations`, `backend/bin/storage-setup.php` |

In production the SPA and API are on different sites, so the session cookie is `SameSite=None; Secure` and the API allows only the SPA origin through `CORS_ALLOWED_ORIGINS`. Details in the Deploy section of `README.md`.
