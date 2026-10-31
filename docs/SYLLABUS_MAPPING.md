# Syllabus Mapping

Every syllabus item and instructor checklist item, with the files that demonstrate it. Paths are relative to the repository root.

The server side exists twice. The PHP 8.3 application in `backend/` is the reference implementation and carries the Unit I (PHP) evidence. The Node.js 22 / Express 5 application in `api/` implements the same 101 routes on the same database and is the one that runs in production, so it carries the Unit VI (Node.js) evidence for the main API. The alerts worker in `services/alerts/` is a second Node.js program. Units III and IV (Java Servlet/JSP and Spring Boot) are optional and are not part of this project.

## Unit I: PHP (`backend/`)

| Topic | Where it is shown |
|---|---|
| Syntax, variables, constants, `declare(strict_types=1)` | Every file in `backend/src`; constants in `backend/src/Validation/Sanitizer.php` (`THREAT_SQL`, `SQL_PATTERNS`) and `backend/src/Services/Reports/UploadedFileValidator.php` (`MAX_BYTES`) |
| Conditions and loops | `Validator::validate` and `Validator::applyConstraints` in `backend/src/Validation/Validator.php`; `SlotGenerator` in `backend/src/Services/Booking/SlotGenerator.php` (date and time loops); `Router::match` in `backend/src/Core/Router.php` |
| Functions | Typed functions and closures throughout; route definitions are closures in `backend/routes/api.php`; static helpers in `backend/src/Services/Booking/SlotCapacity.php` |
| String manipulation | `Sanitizer::clean`, `Sanitizer::detectThreat`, `Sanitizer::escape` (`backend/src/Validation/Sanitizer.php`); `ReferenceCode` (`backend/src/Services/Booking/ReferenceCode.php`); `IcsCalendar::text` and `IcsCalendar::fold` (`backend/src/Services/Booking/IcsCalendar.php`); `UploadedFileValidator::cleanName` |
| Arrays | Rule arrays in `Validator::parseRules`; `array_map`/`array_filter` for the CORS allowlist in `backend/config/app.php`; presenters such as `backend/src/Services/Booking/AppointmentPresenter.php` and `backend/src/Services/PublicContentPresenter.php` |
| Form handling | `Request` (JSON, form and multipart parsing) in `backend/src/Core/Request.php`; `RequestValidator::validate` in `backend/src/Validation/RequestValidator.php`; used by `AuthController::register`, `AppointmentController::store`, `ReportController::store` |
| Cookies | `Cookie::set` and `Cookie::forget` in `backend/src/Core/Cookie.php`; remember-me cookie in `backend/src/Services/RememberMeService.php`; theme cookie in `frontend/src/context/ThemeContext.tsx` and `frontend/src/lib/cookies.ts` |
| Sessions | `Session::start`, `regenerate`, `destroy`, idle and absolute timeout in `backend/src/Core/Session.php`; started by `backend/src/Middleware/StartSessionMiddleware.php`; login in `AuthService::login` (`backend/src/Services/AuthService.php`) |
| File handling: upload | `UploadedFileValidator::validate` and `ReportService::store` (`backend/src/Services/Reports/`); `ImageUploadStore::save` (`backend/src/Services/Admin/ImageUploadStore.php`) for the doctor photo |
| File handling: download | `ReportController::download` and `ReportService::read`; `AppointmentController::ics` serves a generated `.ics` file; storage drivers `backend/src/Services/Storage/LocalStorage.php` and `SupabaseStorage.php` |
| File handling: other | Application and mail log files via `backend/src/Core/Logger.php` and `backend/src/Services/Mail/LogMailer.php` |
| Exception handling | Global handler `ErrorHandler::register` and `render` (`backend/src/Core/ErrorHandler.php`); custom exception classes in `backend/src/Exceptions/` (`ValidationException`, `AuthorizationException`, `SlotFullException`, ...); `HandleErrorsMiddleware`; every error becomes the JSON envelope `{ data: null, error: { code, message } }` |
| Email validation | `Validator::isValidEmail` (`filter_var` plus a format and optional MX check, `MAIL_CHECK_MX`) in `backend/src/Validation/Validator.php`; mirrored in `frontend/src/lib/validation.ts` |
| PHP with database (CRUD) | PDO wrapper `backend/src/Core/Database.php`; base class `backend/src/Models/Model.php`; per-entity models in `backend/src/Models/` (`Appointment`, `Slot`, `Report`, `Referral`, `Branch`, `Faq`, `Review`, `ScanType`, `User`, ...); admin CRUD in `backend/src/Controllers/Admin/` |
| MVC structure | Model: `backend/src/Models`; View: JSON presenters (`backend/src/Services/**/*Presenter.php`) and email templates `backend/templates/emails`; Controller: `backend/src/Controllers`; front controller `backend/public/index.php`; Router and middleware `Pipeline` in `backend/src/Core` |
| Dependency injection | Autowiring container `backend/src/Core/Container.php`, wiring in `backend/config/container.php` |
| Transactions and row locking | `BookingService::book` (`backend/src/Services/Booking/BookingService.php`) with `Slot::lockForUpdate` and `Slot::lockPair` (`SELECT ... FOR UPDATE`) in `backend/src/Models/Slot.php` |

## Unit II and V: React (`frontend/`)

| Topic | Where it is shown |
|---|---|
| Components, JSX | `frontend/src/components/**`, `frontend/src/pages/**` |
| Props | `ServiceCard` (`components/public/ServiceCard.tsx`), `DataTable` (`components/admin/DataTable.tsx`), `TextField` (`components/form/TextField.tsx`) |
| State (`useState`) | `ServicesPage` (`pages/public/ServicesPage.tsx`) holds the modality and search filters |
| Lifting state up | `ServicesPage` owns filter state and passes it down; `SlotPicker` (`features/booking/SlotPicker.tsx`) reports the chosen slot to `BookingWizard` (`features/booking/BookingWizard.tsx`) |
| Composition | `PublicLayout` and `PortalLayout` (`components/layout/`) wrap routed children with `Outlet`; `Primitives.tsx` and `Blocks.tsx` in `components/public/` |
| Parent-to-child and child-to-parent data flow | Props down, callbacks up: `ChecklistStep.tsx` (`onAnswer`), `SlotPicker.tsx` (`onSlotChange`), `Dialog.tsx` (`onClose`) |
| Controlled forms | `components/form/*` with the `useForm` hook (`hooks/useForm.ts`); `LoginPage.tsx`, `RegisterPage.tsx`, `UploadReportForm.tsx` |
| Events | `onChange`, `onBlur` and `onSubmit` in `useForm.ts`; keyboard handling (`onKeyDown`) in `Dialog.tsx` |
| Refs | `useRef` in `Dialog.tsx` (focus return), `VerifyEmailPage.tsx` (run once), `hooks/useApi.ts` (mounted flag), `forwardRef` in `components/form/TextField.tsx` |
| Keys | Lists rendered with stable ids in `DataTable.tsx` (`rowKey`) and `FaqAccordion.tsx` |
| Lifecycle via hooks | `useEffect` in `App.tsx` (restore session with `fetchMe`), `hooks/useApi.ts`, `hooks/usePublicResource.ts`, `ThemeContext.tsx` |
| React Router: nested and protected routes | Route tree in `frontend/src/App.tsx`; `ProtectedRoute` (`components/ProtectedRoute.tsx`) and role tables in `lib/roles.ts` (`ROLE_HOME`, `AREA_ROLES`, `canVisit`, `homeFor`); `GuestRoute`; `AdminLayout` nested routes |
| Redux Toolkit as the single global store | `app/store.ts`, `app/hooks.ts`; slices `features/auth/authSlice.ts` (session), `features/booking/bookingSlice.ts` (draft), `features/alerts/alertsSlice.ts` (alerts), `features/public/publicSlice.ts` (public content cache) with `createAsyncThunk` |
| Context only for a cross-cutting UI concern | `context/ThemeContext.tsx` (light or dark theme); no application data lives in Context |
| `useReducer` | `hooks/useForm.ts` |
| `useMemo` | `ServicesPage.tsx` (`filterScans`), `BookingWizard.tsx`, `EntityForm.tsx`, `BarChart.tsx` |
| `useCallback` | `SiteHeader.tsx`, `FaqAccordion.tsx`, `CrudPage.tsx` |
| Custom hooks | `hooks/useApi.ts` (`useApi`, `useApiQuery`), `hooks/useForm.ts`, `hooks/usePublicResource.ts`, `app/hooks.ts` |
| `React.memo` | `ServiceCard` in `components/public/ServiceCard.tsx` |
| TypeScript types for every API response | `frontend/src/types/` (`api.ts`, `auth.ts`, `booking.ts`, `report.ts`, `referral.ts`, `alerts.ts`, `admin.ts`, `public.ts`); typed calls in `frontend/src/api/*.ts` |
| Error boundaries | `components/ErrorBoundary.tsx`, mounted in `App.tsx` |
| `React.lazy` and `Suspense` | Every page is lazy in `App.tsx`; `Suspense` fallbacks in `PublicLayout.tsx`, `PortalLayout.tsx`, `AdminLayout.tsx` using `PageLoader.tsx` |
| API integration layer with loading and error states | `api/client.ts` (fetch wrapper, CSRF header, `ApiError`), `api/*.ts`, `hooks/useApi.ts` returning `{ data, error, loading }` |
| SEO (optional) | `components/public/StructuredData.tsx` (`MedicalBusiness`, `Physician` JSON-LD), `lib/seo.ts`, `scripts/generate-seo.mjs` (sitemap and robots at build time). Full pre-rendering was not implemented |
| Tests | Vitest and Testing Library next to the code, for example `features/booking/booking.test.tsx`, `components/ProtectedRoute.test.tsx`, `pages/auth/LoginPage.test.tsx` |

## Unit VI: Node.js, main API (`api/`)

| Topic | Where it is shown |
|---|---|
| Modules (ES modules) | `"type": "module"` in `api/package.json`; named exports and imports across `api/src` |
| npm | `api/package.json` (scripts `start`, `dev`, `test`; dependencies `express`, `pg`, `argon2`, `busboy`, `nodemailer`) and `api/package-lock.json`; root `package.json` runs the workspaces with `npm run dev`, `npm test` and `npm run setup` |
| Express | `createApp` in `api/src/app.js` creates the Express server, reads the raw body with `express.raw` and passes each request to the application kernel; `api/src/server.js` listens and shuts down cleanly |
| MVC-style modules | Controllers and route lists in `api/src/modules/<name>/` (22 modules, `index.js` plus `*.controller.js`); models in `api/src/models` (base class `model.js`); JSON presenters such as `services/booking/appointment-presenter.js` and `services/public-content-presenter.js` as the view; email templates in `services/mail/templates` |
| Routing | Declarative `get`, `post`, `put`, `patch`, `del` and `group` helpers with typed parameters (`{id:uuid}`) in `api/src/core/router.js`; all modules assembled in `api/src/routes.js` |
| Middleware pipeline | `compose` in `api/src/core/pipeline.js` and `Kernel` in `api/src/core/kernel.js`; global order in `api/src/middleware/index.js` (cors, security headers, error handling, route matching, session, authentication, CSRF); per-route `auth`, `role`, `verified` and `throttle` middleware |
| Dependency injection container | `createContainer` in `api/src/container.js` builds models, services, mailer, limiter and validator once and passes them to every controller as `app`; tests replace parts of it through `api/test/support/harness.js` |
| Cookies | `Cookies.set` and `forget` in `api/src/core/cookie.js` (HttpOnly, Secure, SameSite); `dc_session` from `api/src/core/session.js`; `dc_remember` in `api/src/services/remember-me-service.js` |
| Sessions | `Session`, `DatabaseSessionStore` and `MemorySessionStore` in `api/src/core/session.js` (idle and absolute timeout, id regeneration, `http_sessions` table from migration 020); started by `api/src/middleware/start-session.js`; login in `api/src/services/auth-service.js`; CSRF seed kept in the session by `api/src/core/csrf.js` |
| File upload | `parseMultipart` and `sniffMime` in `api/src/services/uploads.js` (built on `busboy`); `UploadedFileValidator` in `services/reports/uploaded-file-validator.js`; `ImageUploadStore` in `services/admin/image-upload-store.js` for the doctor photo; `store` in `modules/reports/reports.controller.js` |
| File download | `download` in `api/src/modules/reports/reports.controller.js` (decrypts and streams with `Content-Disposition: attachment`); `ics` in `modules/appointments/appointments.controller.js`; storage drivers in `api/src/services/storage/` |
| File system | Local storage driver `services/storage/local-storage.js`, mail log `services/mail/mailers.js` (`LogMailer`), application log `core/logger.js` |
| Exception handling | Error classes in `api/src/core/errors.js` (`ValidationError`, `AuthorizationError`, `SlotFullError`, ...); `ErrorHandler.render` in `core/error-handler.js`; `middleware/handle-errors.js`; the last Express error handler in `app.js`. Every error becomes the JSON envelope `{ data: null, error: { code, message } }` and production never shows a stack trace |
| Validation | `validator.js`, `sanitizer.js` and `request-validator.js` in `api/src/validation` (rule strings such as `required\|email\|max:120`, threat detection, audit of attacks); tests in `api/test/validator.test.js` |
| Database and transactions | `pg` pool and `Db.tx` in `api/src/core/database.js`; `BookingService.book` in `services/booking/booking-service.js` runs inside `db.tx` with `Slot.lockForUpdate` and `lockPair` (`SELECT ... FOR UPDATE`) in `models/slot.js` |
| Email | `MailService.sendTemplate` in `api/src/services/mail/mail-service.js`; `LogMailer` and `SmtpMailer` (nodemailer) in `mailers.js`, chosen by `MAIL_DRIVER`; templates in `services/mail/templates`; booking and alert emails sent from `services/booking/appointment-notifier.js` and `services/alerts/alert-service.js` |
| Encryption and hashing | Argon2id in `services/password-hasher.js`; AES-256-GCM with key versions in `services/encryption.js`; compatibility with the PHP output checked by `api/test/crypto-compat.test.js` |
| Tests | 330 tests in `api/test/*.test.js` run with `node --test` against a fake database (no network needed); `api/test/live.test.js` adds read-only checks when `LIVE_DB_TESTS=1` |

## Unit VI: Node.js, alerts worker (`services/alerts/`)

| Topic | Where it is shown |
|---|---|
| Modules (ES modules) | `"type": "module"` in `services/alerts/package.json`; imports across `services/alerts/src` |
| npm | `services/alerts/package.json`, scripts `start`, `dev`, `test` |
| Web server | Express app `createApp` in `services/alerts/src/app.js`, started in `services/alerts/src/index.js` |
| REST endpoints | `GET /health`, `GET /api/status`, `GET /api/alerts/open`, `POST /api/jobs/escalate/run`, `POST /api/jobs/reminders/run`, `GET /api/logs/tail` in `src/app.js`; service token check `src/http/auth.js` |
| Static serving | Status page `services/alerts/public/index.html`, `status.js`, `status.css` served by `express.static` |
| File system | Rotating audit log `RotatingLog` in `src/lib/rotatingLog.js`, instance in `src/lib/audit.js`; `audit.tail` backs `/api/logs/tail` |
| Database connectivity | `pg` pool in `src/db.js`, config in `src/config.js` |
| Scheduled jobs | `startScheduler` and `runJob` in `src/jobs/scheduler.js`; escalation `src/jobs/escalation.js` (rules in `escalationLogic.js`); reminders `src/jobs/reminders.js` (rules in `reminderLogic.js`) |
| Email and SMS | `src/channels/emailChannel.js` (nodemailer), `src/channels/smsChannel.js` (documented stub) |
| Tests | `services/alerts/test/escalationLogic.test.js`, `reminderLogic.test.js`, `rotatingLog.test.js` (`node --test`) |

## Instructor checklist

| Item | Evidence |
|---|---|
| Database add, update, delete, view on every main entity | Node controllers are in `api/src/modules/` (`admin-users`, `admin-branches`, `admin-catalog`, `admin-faqs`, `admin-slots`, `appointments`, `reports`, `referrals`, `reviews`, `admin-reviews`, `admin-settings`). The same logic in PHP: Users: `Admin/UserAdminController` (add, view, update; users are deactivated, not deleted, to keep history). Branches, scan categories, scan types, checklist items, FAQs: `Admin/BranchAdminController`, `Admin/CatalogAdminController`, `Admin/FaqAdminController` (full CRUD). Slots: `Admin/SlotAdminController`. Appointments: `AppointmentController` (create, view, reschedule, cancel, status). Reports: `ReportController` (create, view, update, delete). Referrals: `ReferralController`. Reviews: `ReviewController`, `Admin/ReviewAdminController`. Settings: `Admin/SettingsAdminController`. UI: `frontend/src/pages/admin/*` |
| Session and cookie | Node: `api/src/core/session.js` (`dc_session`), `api/src/core/cookie.js`, `api/src/services/remember-me-service.js` (`dc_remember`). PHP: `backend/src/Core/Session.php`, `backend/src/Services/RememberMeService.php`. Theme cookie: `frontend/src/context/ThemeContext.tsx` |
| HTTP methods | GET read, POST create or action, PUT replace, PATCH partial update, DELETE remove, defined in `api/src/modules/*/index.js` (and `backend/routes/api.php`) and explained in `docs/API.md` |
| Encryption | Passwords: Argon2id in `api/src/services/password-hasher.js` (PHP: `password_hash(..., PASSWORD_ARGON2ID)` in `backend/src/Services/PasswordService.php`); reports and notes: AES-256-GCM in `api/src/services/encryption.js` (PHP: `backend/src/Services/EncryptionService.php`), random 12 byte IV, key from env, rotation with `backend/bin/rotate-encryption.php` |
| Validation (client and server) | Server: `api/src/validation/validator.js`, `sanitizer.js`, `request-validator.js` (PHP: `backend/src/Validation/`); client: `frontend/src/lib/validation.ts`, `lib/adminValidation.ts`, `hooks/useForm.ts` |
| Authentication and authorization | `api/src/modules/auth`, `api/src/services/auth-service.js`, `api/src/middleware/require-auth.js` and `role.js`, ownership checks in `services/reports/report-access-policy.js` and `services/alerts/alert-workflow.js` (PHP: `AuthController`, `AuthService`, `RoleMiddleware`, `ReportAccessPolicy`, `AlertWorkflow`); client guards `ProtectedRoute.tsx` |
| File and image upload and download | Node: `api/src/modules/reports/reports.controller.js`, `services/uploads.js`, `services/reports/uploaded-file-validator.js`, doctor photo in `modules/doctor-photo` and `services/admin/image-upload-store.js`, `.ics` download in `modules/appointments`. PHP: `ReportController`, `UploadedFileValidator`, `Admin/DoctorPhotoController`, `ImageUploadStore`. UI in `frontend/src/features/reports/UploadReportForm.tsx` and `lib/reportFile.ts` |

## Feature to file map

Backend paths are PHP reference files under `backend/src`. The Node equivalent has the same name in kebab-case under `api/src` (for example `Services/Booking/BookingService.php` and `api/src/services/booking/booking-service.js`).

| Feature | Backend (PHP) | Frontend |
|---|---|---|
| Booking with locking | `Services/Booking/BookingService.php`, `SlotCapacity.php`, `Models/Slot.php` | `features/booking/BookingWizard.tsx`, `SlotPicker.tsx` |
| Pre-scan checklist | `Services/Booking/ChecklistEvaluator.php`, `Models/ChecklistItem.php` | `features/booking/ChecklistStep.tsx` |
| Calendar export | `IcsCalendar.php`, `GoogleCalendarLink.php` | `features/booking/AppointmentActions.tsx` |
| Reading queue | `Services/Alerts/ReadingQueue.php`, `Models/ReadingQueueQuery.php` | `features/alerts/ReadingQueueTable.tsx` |
| Critical alerts | `Services/Alerts/AlertService.php`, `AlertWorkflow.php`, `Models/CriticalAlert.php`, `AlertEvent.php` | `features/alerts/AlertBanners.tsx`, `StaffAlertsBoard.tsx` |
| Referrer portal | `Controllers/ReferralController.php`, `Models/Referral.php` | `features/referrals/*`, `pages/portal/ReferrerDashboard.tsx` |
| Reviews | `Controllers/ReviewController.php`, `Services/ReviewPolicy.php` | `pages/admin/ReviewsModerationPage.tsx` (public review pages removed) |
| Audit log viewer | `Controllers/Admin/AuditLogController.php`, `Models/AuditLogRepository.php` | `pages/admin/AuditLogPage.tsx` |
