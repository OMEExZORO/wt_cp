<?php

declare(strict_types=1);

use DiagnoCare\Core\Env;

$storage = Env::get('REPORT_STORAGE_PATH', '');

return [
    'env' => Env::get('APP_ENV', 'production'),
    'app_url' => Env::get('APP_URL', 'http://localhost:5173'),
    'db' => [
        'host' => Env::get('DB_HOST', '127.0.0.1'),
        'port' => (int) Env::get('DB_PORT', '3306'),
        'name' => Env::get('DB_NAME', 'diagnocare'),
        'user' => Env::get('DB_USER', 'root'),
        'pass' => Env::get('DB_PASS', ''),
    ],
    'session' => [
        'name' => Env::get('SESSION_NAME', 'diagnocare_sid'),
        'idle_timeout' => (int) Env::get('SESSION_IDLE_TIMEOUT', '1800'),
        'absolute_timeout' => (int) Env::get('SESSION_ABSOLUTE_TIMEOUT', '28800'),
        'secure' => Env::bool('COOKIE_SECURE', false),
        'remember_days' => (int) Env::get('REMEMBER_ME_DAYS', '30'),
    ],
    'reports' => [
        'path' => $storage !== '' ? $storage : dirname(__DIR__) . '/storage/reports',
        'max_bytes' => (int) Env::get('REPORT_MAX_BYTES', '10485760'),
        'key' => Env::get('REPORT_ENCRYPTION_KEY', ''),
    ],
    'log_path' => dirname(__DIR__) . '/storage/logs/app.log',
];
