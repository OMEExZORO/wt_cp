<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;

final class TraceMiddleware implements Middleware
{
    public static array $log = [];

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        self::$log[] = 'before:' . implode(',', $params);
        $response = $next($request);
        self::$log[] = 'after:' . implode(',', $params);
        return $response;
    }
}
