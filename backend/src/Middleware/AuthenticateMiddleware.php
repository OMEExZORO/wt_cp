<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Services\AuthService;

final class AuthenticateMiddleware implements Middleware
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        $request->setUser($this->auth->resolveUser($request));
        return $next($request);
    }
}
