<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'env' => Env::get('APP_ENV', 'production'),
    'url' => Env::get('APP_URL', 'http://localhost:8000'),
    'frontend_url' => Env::get('FRONTEND_URL', 'http://localhost:5173'),
    'api_prefix' => '/api/v1',
    'timezone' => Env::get('APP_TIMEZONE', 'Asia/Kolkata'),
    'storage_bucket' => Env::get('STORAGE_BUCKET', 'reports'),
];
