<?php

declare(strict_types=1);

use App\Core\Response;

require dirname(__DIR__) . '/config/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($path === '/api/v1/health' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    Response::json(['status' => 'ok', 'service' => 'diagnocare-api']);
}

Response::error('NOT_FOUND', 'Resource not found', 404);
