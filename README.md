# DiagnoCare

Website and patient portal for **DiagnoCare**, the radiology practice of **Dr. Meghnad Padsalgikar (MBBS, DMRE, DNB Radiology)**, with two branches in Bhosari, Pune.

| Layer    | Tech                                              |
|----------|---------------------------------------------------|
| Frontend | React 18, React Router 6, Vite 5                  |
| Backend  | Plain PHP 8.1+ REST API (no framework, no Composer) |
| Database | MySQL 8 / MariaDB 10.6+                           |

```
/frontend            React + Vite single-page app
  /public/images     Placeholder photos (swap in real ones, keep the file names)
  /src               Pages, components, API client
/backend
  /public            Web root (index.php front controller only)
  /src               Core classes + controllers
  /config            Configuration (reads backend/.env)
  /storage/reports   Encrypted report files (outside web root)
  /storage/logs      PHP error log
/database
  schema.sql         Full schema (drops and recreates tables)
  seed.sql           Demo data: one user per role, branches, scans, slots
```

## Project status (about 60%)

**Built**

- Public site: Home, About Doctor, Services (X-ray, Sonography, Colour Doppler), Branches (address, timings, embedded Google Map, directions), Contact form.
- Auth: registration (patients; referring doctors stay inactive until the admin approves them), login, logout, bcrypt (cost 12), PHP sessions, 30-day "remember me" cookie (selector/validator, hashed in the DB, rotated on every use), lockout after 5 failed logins in 15 minutes, profile and password change.
- Roles: Patient, Receptionist, Doctor/Admin, Referring Doctor. Every endpoint checks the role on the server, and the role is re-read from the database on each request.
- Appointment booking: choose branch, scan type, date and slot. A unique index on `(slot_id, appointment_date, booking_lock)` blocks double booking in the database, and cancelled or no-show bookings free the slot. If a branch is full or closed on the chosen day, the API suggests the earliest free slot at another branch. If someone takes a slot while the patient is booking, the API returns 409 with the next free slot at the same branch, or the suggestion when that branch is full.
- Reports: the doctor uploads a PDF or JPG for a patient, optionally linked to an appointment. Each upload is checked for its real MIME type (finfo), magic bytes, matching extension, JPG integrity and a 10 MB size limit. The file gets a random name, is encrypted with AES-256-GCM via `openssl_encrypt`, and is stored outside the web root with a SHA-256 integrity check. Patients can download only their own reports, and referring doctors only reports for appointments they referred.
- Admin panel (Doctor): create, edit and delete branches, scan types, weekly slots (with bulk generator) and staff accounts, plus the contact-message inbox.

**Stubbed (tables, read-only API and basic UI, no workflow logic yet)**

- Pre-scan safety checklist per scan type: `safety_checklist_items`, `safety_checklist_responses`.
- Critical-finding alerts with acknowledgement and escalation: `critical_alerts`, `critical_alert_escalations`. The acknowledge and escalate endpoints return `501`.
- Priority reading queue (STAT, Urgent, Routine): `reading_queue`.

**Not started yet:** email/SMS notifications, rescheduling, payments and invoices, audit log, PACS/DICOM integration and reporting templates.

## Setup

### 1. Requirements

- PHP 8.1+ with `pdo_mysql`, `openssl`, `fileinfo`, `mbstring`
- MySQL 8+ or MariaDB 10.6+
- Node.js 18+ and npm

### 2. Database

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql

mysql -u root -p -e "CREATE USER 'diagnocare'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON diagnocare.* TO 'diagnocare'@'localhost';"
```

`schema.sql` creates the `diagnocare` database and **drops existing tables**. Only run it on a fresh install.

### 3. Backend

```bash
cd backend
cp .env.example .env
php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
```

Edit `backend/.env`:

- `DB_USER` and `DB_PASS`: the MySQL user created above.
- `REPORT_ENCRYPTION_KEY`: paste the base64 key printed above. **Back it up.** Reports cannot be decrypted without it.
- `COOKIE_SECURE=true` in production (HTTPS).
- `REPORT_STORAGE_PATH` (optional): absolute path for encrypted reports. The default is `backend/storage/reports`. The app refuses any path inside `backend/public`.

Make `backend/storage/reports` and `backend/storage/logs` writable by the PHP user.

Run the API in development:

```bash
php -d upload_max_filesize=12M -d post_max_size=13M -S 127.0.0.1:8000 -t public public/index.php
```

Check it with `curl http://127.0.0.1:8000/api/health`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://127.0.0.1:8000`, so the browser sees a single origin and the session cookie works without CORS. Set `VITE_API_PROXY` if the API runs elsewhere.

### 5. Production (Apache example)

```bash
cd frontend && npm run build
```

```apache
<VirtualHost *:443>
    ServerName diagnocare.example
    DocumentRoot /var/www/diagnocare/frontend/dist

    Alias /api /var/www/diagnocare/backend/public
    <Directory /var/www/diagnocare/backend/public>
        AllowOverride All
        Require all granted
    </Directory>
    <Directory /var/www/diagnocare/frontend/dist>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

`frontend/public/.htaccess` is copied into `dist/` and handles client-side routes. `backend/public/.htaccess` sends every `/api/*` request to `index.php`. Only `backend/public` is reachable over the web. Keep `.env`, `src`, `config` and `storage` outside it.

## Demo accounts (seed data)

All accounts use the password **`Password@123`**. Change them before going live.

| Role             | Email                       | Name                    |
|------------------|-----------------------------|-------------------------|
| Doctor / Admin   | `doctor@diagnocare.test`    | Dr. Meghnad Padsalgikar |
| Receptionist     | `reception@diagnocare.test` | Priya Kulkarni          |
| Patient          | `patient@diagnocare.test`   | Rahul Patil             |
| Referring Doctor | `referrer@diagnocare.test`  | Dr. Anjali Deshmukh     |

The seed also creates:

- Two branches (Bhosari Gaon, closed Sunday; MIDC Bhosari, open Sunday morning).
- Eight scan types.
- 20-minute slots: Mon–Sat 9:00–13:00 and 17:00–20:00 at both branches, plus Sunday morning at MIDC.
- Checklist questions.
- One demo appointment, one queue entry and one demo alert.

**Branch addresses, phone numbers, emails and registration numbers in the seed are placeholders.** Update them in *Admin → Branches* and *Admin → Staff*.

## Replacing placeholder images

Every image in `frontend/public/images` is a labelled placeholder. Replace each file with a real photo under the **same file name**. `frontend/public/images/README.md` lists each file, where it appears and the suggested size. Branch photos can also be renamed per branch in *Admin → Branches → Photo file name*.

## Security notes

- **SQL:** PDO only, with native prepared statements (`ATTR_EMULATE_PREPARES = false`). No query is built from user input.
- **Validation:** every input goes through `Validator` on the server (types, lengths, enums, dates, Indian mobile numbers, pincodes, password strength). The checks in the frontend are only for convenience.
- **Output encoding:** `Response::json` runs `htmlspecialchars` (`ENT_QUOTES | ENT_SUBSTITUTE`) over every string in every API response and encodes with the `JSON_HEX_*` flags. The React API client decodes those entities once, and React escapes everything again when it renders. Nothing uses `dangerouslySetInnerHTML`.
- **CSRF:** a per-session 256-bit token. Every POST, PUT, PATCH and DELETE must send it in the `X-CSRF-Token` header, and it is compared with `hash_equals`. The token is rotated on login and logout.
- **Sessions:**
  - The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when configured.
  - Strict mode is on, and the session ID is regenerated on login.
  - Sessions end after 30 minutes idle or 8 hours total (both configurable).
  - The SPA logs out idle users and tells them their session expired.
- **Remember me:** only a SHA-256 hash of the validator is stored. A token is single-use and rotated. A selector match with a wrong validator revokes all of that user's tokens. Changing the password revokes all tokens.
- **Uploads:** checked as described under Reports above. Files are encrypted at rest with authenticated encryption (GCM tag and SHA-256 check) and sent with `Content-Disposition: attachment`, `nosniff` and `CSP: default-src 'none'`.
- **Headers:** `X-Frame-Options: DENY`, `Referrer-Policy`, `Cache-Control: no-store` on all API responses.
- **Errors:** errors are logged to `backend/storage/logs/app.log`. Clients only see generic messages.

## API overview

All routes are under `/api`. Responses look like `{ success, message, data }`, and validation errors add `errors: { field: message }`.

| Method & path | Roles |
|---|---|
| `GET /csrf`, `GET /health` | public |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | public |
| `PUT /auth/profile`, `PUT /auth/password` | any logged-in user |
| `GET /branches`, `GET /scan-types`, `POST /contact` | public |
| `GET /appointments/availability?branch_id&date` | patient, receptionist, doctor |
| `GET /appointments`, `GET /appointments/{id}` | all roles (scoped to own or referred records) |
| `POST /appointments` | patient (self), receptionist and doctor (any patient) |
| `PATCH /appointments/{id}/status` | patient (cancel own, at least 2 h ahead), receptionist, doctor |
| `GET /patients?q=` | receptionist, doctor |
| `GET /referring-doctors` | any logged-in user |
| `GET /reports`, `GET /reports/{id}/download` | patient (own), referring doctor (referred), doctor |
| `POST /reports` (multipart), `DELETE /reports/{id}` | doctor |
| `GET/POST /admin/branches`, `PUT/DELETE /admin/branches/{id}` | doctor (GET also receptionist) |
| `GET/POST /admin/scan-types`, `PUT/DELETE /admin/scan-types/{id}` | doctor (GET also receptionist) |
| `GET/POST /admin/slots`, `POST /admin/slots/generate`, `PUT/DELETE /admin/slots/{id}` | doctor (GET also receptionist) |
| `GET/POST /admin/staff`, `PUT/DELETE /admin/staff/{id}` | doctor |
| `GET /admin/messages`, `PATCH /admin/messages/{id}/read` | receptionist, doctor |
| `GET /clinical/checklists` | receptionist, doctor (stub) |
| `GET /clinical/alerts`, `GET /clinical/reading-queue` | doctor (stub) |
| `POST /clinical/alerts/{id}/acknowledge`, `.../escalate` | doctor (returns 501) |

Deleting a branch, scan type or slot that has booking history deactivates it instead. Deleting a staff account always deactivates it, so audit history is kept.
