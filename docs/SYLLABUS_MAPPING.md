# Syllabus Mapping

Every syllabus item and instructor checklist item, with the files that demonstrate it. Paths are relative to the repository root. Units III and IV (Java Servlet/JSP and Spring Boot) are optional and were not started.

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

## Unit VI: Node.js (`services/alerts/`)

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
| Database add, update, delete, view on every main entity | Users: `Admin/UserAdminController` (add, view, update; users are deactivated, not deleted, to keep history). Branches, scan categories, scan types, checklist items, FAQs: `Admin/BranchAdminController`, `Admin/CatalogAdminController`, `Admin/FaqAdminController` (full CRUD). Slots: `Admin/SlotAdminController`. Appointments: `AppointmentController` (create, view, reschedule, cancel, status). Reports: `ReportController` (create, view, update, delete). Referrals: `ReferralController`. Reviews: `ReviewController`, `Admin/ReviewAdminController`. Settings: `Admin/SettingsAdminController`. UI: `frontend/src/pages/admin/*` |
| Session and cookie | Login session `backend/src/Core/Session.php` (`dc_session`); remember-me cookie `backend/src/Services/RememberMeService.php` (`dc_remember`); theme cookie `frontend/src/context/ThemeContext.tsx` |
| HTTP methods | GET read, POST create or action, PUT replace, PATCH partial update, DELETE remove, defined in `backend/routes/api.php` and explained in `docs/API.md` |
| Encryption | Passwords: `password_hash(..., PASSWORD_ARGON2ID)` in `backend/src/Services/PasswordService.php`, `RegistrationService.php`, `Controllers/Admin/UserAdminController.php`; reports and notes: AES-256-GCM in `backend/src/Services/EncryptionService.php` (random 12 byte IV, key from env), rotation `backend/bin/rotate-encryption.php` |
| Validation (client and server) | Server: `backend/src/Validation/Validator.php`, `Sanitizer.php`, `RequestValidator.php`; client: `frontend/src/lib/validation.ts`, `lib/adminValidation.ts`, `hooks/useForm.ts` |
| Authentication and authorization | `AuthController`, `AuthService`, `Middleware/RequireAuthMiddleware.php`, `Middleware/RoleMiddleware.php`, ownership checks in `Services/Reports/ReportAccessPolicy.php` and `Services/Alerts/AlertWorkflow.php`; client guards `ProtectedRoute.tsx` |
| File and image upload and download | Reports (`ReportController`, `UploadedFileValidator`), doctor photo (`Admin/DoctorPhotoController`, `ImageUploadStore`), `.ics` download, UI in `frontend/src/features/reports/UploadReportForm.tsx` and `lib/reportFile.ts` |

## Feature to file map

| Feature | Backend | Frontend |
|---|---|---|
| Booking with locking | `Services/Booking/BookingService.php`, `SlotCapacity.php`, `Models/Slot.php` | `features/booking/BookingWizard.tsx`, `SlotPicker.tsx` |
| Pre-scan checklist | `Services/Booking/ChecklistEvaluator.php`, `Models/ChecklistItem.php` | `features/booking/ChecklistStep.tsx` |
| Calendar export | `IcsCalendar.php`, `GoogleCalendarLink.php` | `features/booking/AppointmentActions.tsx` |
| Reading queue | `Services/Alerts/ReadingQueue.php`, `Models/ReadingQueueQuery.php` | `features/alerts/ReadingQueueTable.tsx` |
| Critical alerts | `Services/Alerts/AlertService.php`, `AlertWorkflow.php`, `Models/CriticalAlert.php`, `AlertEvent.php` | `features/alerts/AlertBanners.tsx`, `StaffAlertsBoard.tsx` |
| Referrer portal | `Controllers/ReferralController.php`, `Models/Referral.php` | `features/referrals/*`, `pages/portal/ReferrerDashboard.tsx` |
| Reviews | `Controllers/ReviewController.php`, `Services/ReviewPolicy.php` | `pages/portal/WriteReviewPage.tsx`, `components/public/ReviewsPanel.tsx` |
| Audit log viewer | `Controllers/Admin/AuditLogController.php`, `Models/AuditLogRepository.php` | `pages/admin/AuditLogPage.tsx` |
