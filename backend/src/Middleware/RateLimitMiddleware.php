<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\RateLimitException;
use App\Services\AuditLogger;
use App\Services\RateLimiter;

final class RateLimitMiddleware implements Middleware
{
    public function __construct(private readonly RateLimiter $limiter, private readonly AuditLogger $audit)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        $name = $params[0] ?? 'default';
        $max = isset($params[1]) ? max(1, (int) $params[1]) : 60;
        $minutes = isset($params[2]) ? max(1, (int) $params[2]) : 1;
        $identity = $request->user()['id'] ?? ($request->ip() ?? 'unknown');
        try {
            $this->limiter->attempt($name . ':' . $identity, $max, $minutes * 60);
        } catch (RateLimitException $e) {
            $this->audit->log('security.rate_limited', $request, ['metadata' => ['limiter' => $name]]);
            throw $e;
        }
        return $next($request);
    }
}
