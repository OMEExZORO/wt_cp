<?php

declare(strict_types=1);

use App\Core\Env;

$backendRoot = dirname(__DIR__);
$repoRoot = dirname($backendRoot);

require $backendRoot . '/vendor/autoload.php';

Env::load($backendRoot . '/.env', $repoRoot . '/.env');

date_default_timezone_set(Env::get('APP_TIMEZONE', 'Asia/Kolkata'));

return [
    'backend_root' => $backendRoot,
    'repo_root' => $repoRoot,
];
