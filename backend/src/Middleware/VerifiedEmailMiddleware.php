<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\AuthenticationException;
use App\Exceptions\AuthorizationException;

final class VerifiedEmailMiddleware implements Middleware
{
    public function handle(Request $request, callable $next, string ...$params): Response
    {
        $user = $request->user();
        if ($user === null) {
            throw new AuthenticationException();
        }
        if (empty($user['email_verified_at'])) {
            throw new AuthorizationException('Please verify your email address to use this feature.');
        }
        return $next($request);
    }
}
