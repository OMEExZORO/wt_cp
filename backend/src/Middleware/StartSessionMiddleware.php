<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

final class StartSessionMiddleware implements Middleware
{
    public function __construct(private readonly Session $session)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        $this->session->start();
        $request->setAttribute('session_expired', $this->session->wasExpired());
        $response = $next($request);
        if ($this->session->isActive()) {
            session_write_close();
        }
        return $response;
    }
}
