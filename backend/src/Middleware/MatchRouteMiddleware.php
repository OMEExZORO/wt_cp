<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

final class MatchRouteMiddleware implements Middleware
{
    public function __construct(private readonly Router $router)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        [$route, $routeParams] = $this->router->match($request->method(), $request->path());
        $request->setAttribute('route', $route);
        $request->setAttribute('route_params', $routeParams);
        return $next($request);
    }
}
