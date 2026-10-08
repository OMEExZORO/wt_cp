<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\EmailVerificationController;
use App\Controllers\HealthController;
use App\Controllers\PasswordController;
use App\Core\Router;

return static function (Router $router): void {
    $router->group('/api/v1', [], static function (Router $router): void {
        $router->get('/health', [HealthController::class, 'show']);

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

        $router->group('/dashboards', ['auth'], static function (Router $router): void {
            $router->get('/patient', [DashboardController::class, 'show'], ['role:patient']);
            $router->get('/doctor', [DashboardController::class, 'show'], ['role:doctor,admin']);
            $router->get('/receptionist', [DashboardController::class, 'show'], ['role:receptionist,admin']);
            $router->get('/admin', [DashboardController::class, 'show'], ['role:admin']);
            $router->get('/referrer', [DashboardController::class, 'show'], ['role:referrer']);
        });
    });
};
