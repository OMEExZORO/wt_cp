<?php

declare(strict_types=1);

use App\Controllers\AppointmentController;
use App\Controllers\AuthController;
use App\Controllers\BookingController;
use App\Controllers\DashboardController;
use App\Controllers\EmailVerificationController;
use App\Controllers\HealthController;
use App\Controllers\PasswordController;
use App\Controllers\PublicController;
use App\Controllers\Admin\AuditLogController;
use App\Controllers\Admin\BranchAdminController;
use App\Controllers\Admin\CatalogAdminController;
use App\Controllers\Admin\DoctorPhotoController;
use App\Controllers\Admin\FaqAdminController;
use App\Controllers\Admin\ReviewAdminController;
use App\Controllers\Admin\SettingsAdminController;
use App\Controllers\Admin\SlotAdminController;
use App\Controllers\Admin\StatsController;
use App\Controllers\Admin\UserAdminController;
use App\Controllers\ReviewController;
use App\Core\Router;

return static function (Router $router): void {
    $router->group('/api/v1', [], static function (Router $router): void {
        $router->get('/health', [HealthController::class, 'show']);

        $router->group('/public', [], static function (Router $router): void {
            $router->get('/site', [PublicController::class, 'site']);
            $router->get('/doctor', [PublicController::class, 'doctor']);
            $router->get('/branches', [PublicController::class, 'branches']);
            $router->get('/scan-categories', [PublicController::class, 'scanCategories']);
            $router->get('/scan-types', [PublicController::class, 'scanTypes']);
            $router->get('/scan-types/{ref}', [PublicController::class, 'scanType']);
            $router->get('/faqs', [PublicController::class, 'faqs']);
            $router->get('/reviews', [PublicController::class, 'reviews']);
        });

        $router->group('/auth', [], static function (Router $router): void {
            $router->get('/csrf', [AuthController::class, 'csrf']);
            $router->post('/register', [AuthController::class, 'register'], ['throttle:register,10,60']);
            $router->post('/login', [AuthController::class, 'login'], ['throttle:login,20,10']);
            $router->post('/logout', [AuthController::class, 'logout']);
            $router->get('/me', [AuthController::class, 'me'], ['auth']);
            $router->patch('/me', [AuthController::class, 'updateMe'], ['auth']);
            $router->delete('/sessions', [AuthController::class, 'logoutEverywhere'], ['auth']);
            $router->post('/password/forgot', [PasswordController::class, 'forgot'], ['throttle:forgot,5,15']);
            $router->post('/password/reset', [PasswordController::class, 'reset'], ['throttle:reset,10,15']);
            $router->put('/password', [PasswordController::class, 'change'], ['auth', 'throttle:password-change,10,15']);
            $router->post('/email/verify', [EmailVerificationController::class, 'verify'], ['throttle:verify,20,15']);
            $router->post('/email/resend', [EmailVerificationController::class, 'resend'], ['auth', 'throttle:verify-resend,3,15']);
        });

        $router->group('/booking', ['auth'], static function (Router $router): void {
            $router->get('/availability', [BookingController::class, 'availability']);
            $router->get('/days', [BookingController::class, 'days']);
            $router->get('/next-available', [BookingController::class, 'nextAvailable']);
        });

        $router->get('/scan-types/{id:uuid}/checklist', [BookingController::class, 'checklist'], ['auth']);

        $router->group('/appointments', ['auth'], static function (Router $router): void {
            $router->get('', [AppointmentController::class, 'index'], ['role:patient,receptionist,doctor,admin']);
            $router->post('', [AppointmentController::class, 'store'], ['role:patient,receptionist,admin', 'verified', 'throttle:booking,30,60']);
            $router->get('/{id:uuid}', [AppointmentController::class, 'show'], ['role:patient,receptionist,doctor,admin']);
            $router->get('/{id:uuid}/ics', [AppointmentController::class, 'ics'], ['role:patient,receptionist,doctor,admin']);
            $router->patch('/{id:uuid}/reschedule', [AppointmentController::class, 'reschedule'], ['role:patient,receptionist,admin', 'verified', 'throttle:booking-change,30,60']);
            $router->patch('/{id:uuid}/cancel', [AppointmentController::class, 'cancel'], ['role:patient,receptionist,admin', 'throttle:booking-change,30,60']);
            $router->patch('/{id:uuid}/status', [AppointmentController::class, 'updateStatus'], ['role:receptionist,doctor,admin']);
        });

        $router->group('/dashboards', ['auth'], static function (Router $router): void {
            $router->get('/patient', [DashboardController::class, 'show'], ['role:patient']);
            $router->get('/doctor', [DashboardController::class, 'show'], ['role:doctor,admin']);
            $router->get('/receptionist', [DashboardController::class, 'show'], ['role:receptionist,admin']);
            $router->get('/admin', [DashboardController::class, 'show'], ['role:admin']);
            $router->get('/referrer', [DashboardController::class, 'show'], ['role:referrer']);
        });

        $router->get('/public/doctor/photo', [DoctorPhotoController::class, 'show']);

        $router->group('/reviews', ['auth'], static function (Router $router): void {
            $router->get('/mine', [ReviewController::class, 'mine'], ['role:patient']);
            $router->post('', [ReviewController::class, 'store'], ['role:patient', 'throttle:reviews,5,60']);
        });

        $router->group('/admin', ['auth', 'role:admin'], static function (Router $router): void {
            $router->get('/stats', [StatsController::class, 'show']);
            $router->get('/audit-log', [AuditLogController::class, 'index']);

            $router->get('/users', [UserAdminController::class, 'index']);
            $router->post('/users', [UserAdminController::class, 'store']);
            $router->patch('/users/{id:uuid}', [UserAdminController::class, 'update']);
            $router->post('/users/{id:uuid}/password-reset', [UserAdminController::class, 'passwordReset'], ['throttle:admin-password-reset,20,60']);

            $router->get('/branches', [BranchAdminController::class, 'index']);
            $router->post('/branches', [BranchAdminController::class, 'store']);
            $router->put('/branches/{id:uuid}', [BranchAdminController::class, 'update']);
            $router->patch('/branches/{id:uuid}', [BranchAdminController::class, 'update']);
            $router->delete('/branches/{id:uuid}', [BranchAdminController::class, 'destroy']);

            $router->get('/scan-categories', [CatalogAdminController::class, 'categoryIndex']);
            $router->post('/scan-categories', [CatalogAdminController::class, 'categoryStore']);
            $router->put('/scan-categories/{id:uuid}', [CatalogAdminController::class, 'categoryUpdate']);
            $router->patch('/scan-categories/{id:uuid}', [CatalogAdminController::class, 'categoryUpdate']);
            $router->delete('/scan-categories/{id:uuid}', [CatalogAdminController::class, 'categoryDestroy']);

            $router->get('/scan-types', [CatalogAdminController::class, 'typeIndex']);
            $router->post('/scan-types', [CatalogAdminController::class, 'typeStore']);
            $router->put('/scan-types/{id:uuid}', [CatalogAdminController::class, 'typeUpdate']);
            $router->patch('/scan-types/{id:uuid}', [CatalogAdminController::class, 'typeUpdate']);
            $router->delete('/scan-types/{id:uuid}', [CatalogAdminController::class, 'typeDestroy']);

            $router->get('/checklist-items', [CatalogAdminController::class, 'checklistIndex']);
            $router->post('/checklist-items', [CatalogAdminController::class, 'checklistStore']);
            $router->put('/checklist-items/{id:uuid}', [CatalogAdminController::class, 'checklistUpdate']);
            $router->patch('/checklist-items/{id:uuid}', [CatalogAdminController::class, 'checklistUpdate']);
            $router->delete('/checklist-items/{id:uuid}', [CatalogAdminController::class, 'checklistDestroy']);

            $router->get('/slots', [SlotAdminController::class, 'index']);
            $router->post('/slots/generate', [SlotAdminController::class, 'generate'], ['throttle:admin-slot-generate,20,60']);
            $router->patch('/slots/{id:uuid}', [SlotAdminController::class, 'update']);
            $router->delete('/slots/{id:uuid}', [SlotAdminController::class, 'destroy']);

            $router->get('/settings', [SettingsAdminController::class, 'index']);
            $router->patch('/settings', [SettingsAdminController::class, 'update']);
            $router->post('/doctor/photo', [DoctorPhotoController::class, 'upload']);
            $router->delete('/doctor/photo', [DoctorPhotoController::class, 'destroy']);

            $router->get('/faqs', [FaqAdminController::class, 'index']);
            $router->post('/faqs', [FaqAdminController::class, 'store']);
            $router->put('/faqs/{id:uuid}', [FaqAdminController::class, 'update']);
            $router->patch('/faqs/{id:uuid}', [FaqAdminController::class, 'update']);
            $router->delete('/faqs/{id:uuid}', [FaqAdminController::class, 'destroy']);

            $router->get('/reviews', [ReviewAdminController::class, 'index']);
            $router->patch('/reviews/{id:uuid}', [ReviewAdminController::class, 'moderate']);
        });
    });
};
