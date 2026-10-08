<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\AuthenticationException;

final class RequireAuthMiddleware implements Middleware
{
    public function handle(Request $request, callable $next, string ...$params): Response
    {
        if ($request->user() === null) {
            throw new AuthenticationException(
                $request->attribute('session_expired') === true
                    ? 'Your session expired due to inactivity. Please sign in again.'
                    : 'Please sign in to continue.'
            );
        }
        return $next($request);
    }
}
