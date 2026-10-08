<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;

final class SecurityHeadersMiddleware implements Middleware
{
    public function __construct(private readonly Config $config)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        $response = $next($request);
        $response->setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        $response->setHeader('X-Content-Type-Options', 'nosniff');
        $response->setHeader('X-Frame-Options', 'DENY');
        $response->setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        $response->setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        if ($response->header('Cache-Control') === null) {
            $response->setHeader('Cache-Control', 'no-store');
        }
        if ($this->config->isProduction()) {
            $response->setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        if (function_exists('header_remove') && !headers_sent()) {
            header_remove('X-Powered-By');
        }
        return $response;
    }
}
