<?php

declare(strict_types=1);

use App\Controllers\AlertController;
use App\Controllers\AppointmentController;
use App\Controllers\AuthController;
use App\Controllers\BookingController;
use App\Controllers\DashboardController;
use App\Controllers\EmailVerificationController;
use App\Controllers\HealthController;
use App\Controllers\PasswordController;
use App\Controllers\PublicController;
use App\Controllers\QueueController;
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

        $router->post('/reports/{id:uuid}/critical', [AlertController::class, 'flag'], ['auth', 'role:doctor,admin', 'throttle:alert-flag,20,10']);
        $router->get('/doctor/queue', [QueueController::class, 'show'], ['auth', 'role:doctor,admin']);
        $router->group('/alerts', ['auth'], static function (Router $router): void {
            $router->get('/mine', [AlertController::class, 'mine'], ['role:patient,referrer']);
            $router->get('', [AlertController::class, 'index'], ['role:receptionist,doctor,admin']);
            $router->get('/{id:uuid}/events', [AlertController::class, 'events'], ['role:receptionist,doctor,admin']);
            $router->post('/{id:uuid}/acknowledge', [AlertController::class, 'acknowledge'], ['role:patient,referrer', 'throttle:alert-ack,30,10']);
            $router->patch('/{id:uuid}/resolve', [AlertController::class, 'resolve'], ['role:receptionist,admin']);
        });

        $router->group('/dashboards', ['auth'], static function (Router $router): void {
            $router->get('/patient', [DashboardController::class, 'show'], ['role:patient']);
            $router->get('/doctor', [DashboardController::class, 'show'], ['role:doctor,admin']);
            $router->get('/receptionist', [DashboardController::class, 'show'], ['role:receptionist,admin']);
            $router->get('/admin', [DashboardController::class, 'show'], ['role:admin']);
            $router->get('/referrer', [DashboardController::class, 'show'], ['role:referrer']);
        });
    });
};
