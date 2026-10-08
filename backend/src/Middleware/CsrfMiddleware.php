<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Csrf;
use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\CsrfException;
use App\Services\AuditLogger;

final class CsrfMiddleware implements Middleware
{
    public function __construct(private readonly Csrf $csrf, private readonly AuditLogger $audit)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        if (!$request->isMethodSafe() && !$this->csrf->validate($request->header(Csrf::HEADER))) {
            $this->audit->log('security.csrf_rejected', $request, [
                'metadata' => ['had_token' => $request->header(Csrf::HEADER) !== null],
            ]);
            throw new CsrfException();
        }
        return $next($request);
    }
}
