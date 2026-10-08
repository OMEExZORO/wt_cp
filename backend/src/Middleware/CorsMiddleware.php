<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\AuthorizationException;

final class CorsMiddleware implements Middleware
{
    private const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    private const ALLOWED_HEADERS = 'Accept, Content-Type, X-CSRF-Token, X-Requested-With';

    public function __construct(private readonly Config $config)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        $origin = $request->header('origin');
        $allowed = $origin !== null && $this->isAllowed($origin);

        if ($request->method() === 'OPTIONS' && $request->header('access-control-request-method') !== null) {
            $response = Response::noContent();
            if ($allowed) {
                $this->apply($response, $origin);
                $response->setHeader('Access-Control-Allow-Methods', self::ALLOWED_METHODS);
                $response->setHeader('Access-Control-Allow-Headers', self::ALLOWED_HEADERS);
                $response->setHeader('Access-Control-Max-Age', (string) $this->config->get('cors.max_age', 600));
            }
            $response->setHeader('Vary', 'Origin');
            return $response;
        }

        if ($origin !== null && !$allowed && !$request->isMethodSafe()) {
            throw new AuthorizationException('This origin is not allowed to call the API.');
        }

        $response = $next($request);
        if ($allowed) {
            $this->apply($response, $origin);
        }
        $response->setHeader('Vary', 'Origin');
        return $response;
    }

    public function isAllowed(string $origin): bool
    {
        return in_array(rtrim($origin, '/'), (array) $this->config->get('cors.allowed_origins', []), true);
    }

    private function apply(Response $response, string $origin): void
    {
        $response->setHeader('Access-Control-Allow-Origin', $origin);
        $response->setHeader('Access-Control-Allow-Credentials', 'true');
        $response->setHeader('Access-Control-Expose-Headers', 'Retry-After');
    }
}
