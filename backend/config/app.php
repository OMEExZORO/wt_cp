<?php

declare(strict_types=1);

use App\Core\Env;

$backendRoot = dirname(__DIR__);
$env = Env::get('APP_ENV', 'production');
$isProduction = $env === 'production';
$frontendUrl = rtrim(Env::get('FRONTEND_URL', 'http://localhost:5173'), '/');
$sameSite = ucfirst(strtolower(Env::get('SESSION_SAMESITE', $isProduction ? 'None' : 'Lax')));
$secure = Env::bool('SESSION_SECURE', $isProduction) || $sameSite === 'None';

return [
    'env' => $env,
    'debug' => !$isProduction && Env::bool('APP_DEBUG', true),
    'url' => Env::get('APP_URL', 'http://localhost:8000'),
    'frontend_url' => $frontendUrl,
    'api_prefix' => '/api/v1',
    'timezone' => Env::get('APP_TIMEZONE', 'Asia/Kolkata'),
    'storage_bucket' => Env::get('STORAGE_BUCKET', 'reports'),
    'trust_proxy' => Env::bool('TRUST_PROXY', false),
    'cors' => [
        'allowed_origins' => array_values(array_unique(array_filter(array_map(
            static fn (string $origin): string => rtrim(trim($origin), '/'),
            explode(',', Env::get('CORS_ALLOWED_ORIGINS', $frontendUrl))
        )))),
        'max_age' => 600,
    ],
    'session' => [
        'name' => 'dc_session',
        'idle_minutes' => Env::int('SESSION_IDLE_MINUTES', 30),
        'absolute_hours' => Env::int('SESSION_ABSOLUTE_HOURS', 12),
        'secure' => $secure,
        'samesite' => in_array($sameSite, ['Lax', 'Strict', 'None'], true) ? $sameSite : 'Lax',
        'domain' => Env::get('SESSION_DOMAIN', ''),
        'save_path' => $backendRoot . '/storage/sessions',
    ],
    'remember' => [
        'cookie' => 'dc_remember',
        'days' => Env::int('REMEMBER_DAYS', 30),
        'grace_seconds' => 60,
    ],
    'auth' => [
        'max_failed_attempts' => Env::int('LOGIN_MAX_ATTEMPTS', 5),
        'lockout_minutes' => Env::int('LOGIN_LOCKOUT_MINUTES', 15),
        'ip_max_failed_attempts' => Env::int('LOGIN_IP_MAX_ATTEMPTS', 30),
        'ip_window_minutes' => 15,
        'require_verified_email_for_login' => false,
        'reset_token_minutes' => 60,
        'verify_token_hours' => 48,
        'consent_version' => '2026-10-v1',
    ],
    'mail' => [
        'driver' => Env::get('MAIL_DRIVER', 'log'),
        'from' => Env::get('MAIL_FROM', 'no-reply@example.com'),
        'from_name' => Env::get('MAIL_FROM_NAME', 'Meghnad Diagnostic Centre'),
        'smtp_host' => Env::get('SMTP_HOST', ''),
        'smtp_port' => Env::int('SMTP_PORT', 587),
        'smtp_user' => Env::get('SMTP_USER', ''),
        'smtp_pass' => Env::get('SMTP_PASS', ''),
        'smtp_encryption' => Env::get('SMTP_ENCRYPTION', 'tls'),
        'log_path' => $backendRoot . '/storage/logs/mail.log',
        'templates' => $backendRoot . '/templates/emails',
    ],
    'log_path' => $backendRoot . '/storage/logs/app.log',
    'storage_path' => $backendRoot . '/storage',
];
