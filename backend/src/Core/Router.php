<?php

declare(strict_types=1);

namespace App\Core;

use App\Exceptions\MethodNotAllowedException;
use App\Exceptions\NotFoundException;

final class Router
{
    private const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    private array $routes = [];
    private string $prefix = '';
    private array $groupMiddleware = [];

    public function get(string $path, mixed $handler, array $middleware = []): Route
    {
        return $this->add('GET', $path, $handler, $middleware);
    }

    public function post(string $path, mixed $handler, array $middleware = []): Route
    {
        return $this->add('POST', $path, $handler, $middleware);
    }

    public function put(string $path, mixed $handler, array $middleware = []): Route
    {
        return $this->add('PUT', $path, $handler, $middleware);
    }

    public function patch(string $path, mixed $handler, array $middleware = []): Route
    {
        return $this->add('PATCH', $path, $handler, $middleware);
    }

    public function delete(string $path, mixed $handler, array $middleware = []): Route
    {
        return $this->add('DELETE', $path, $handler, $middleware);
    }

    public function group(string $prefix, array $middleware, callable $callback): void
    {
        $previousPrefix = $this->prefix;
        $previousMiddleware = $this->groupMiddleware;
        $this->prefix = rtrim($previousPrefix . '/' . trim($prefix, '/'), '/');
        $this->groupMiddleware = array_merge($previousMiddleware, $middleware);
        try {
            $callback($this);
        } finally {
            $this->prefix = $previousPrefix;
            $this->groupMiddleware = $previousMiddleware;
        }
    }

    public function add(string $method, string $path, mixed $handler, array $middleware = []): Route
    {
        $method = strtoupper($method);
        if (!in_array($method, self::METHODS, true)) {
            throw new \InvalidArgumentException(sprintf('Unsupported HTTP method %s', $method));
        }
        $full = $this->prefix . '/' . trim($path, '/');
        $full = $full === '/' ? '/' : rtrim($full, '/');
        $route = new Route($method, $full, $handler, array_merge($this->groupMiddleware, $middleware));
        $this->routes[] = $route;
        return $route;
    }

    public function routes(): array
    {
        return $this->routes;
    }

    public function match(string $method, string $path): array
    {
        $method = strtoupper($method);
        $lookup = $method === 'HEAD' ? 'GET' : $method;
        $allowed = [];
        foreach ($this->routes as $route) {
            $params = $route->match($path);
            if ($params === null) {
                continue;
            }
            if ($route->method === $lookup) {
                return [$route, $params];
            }
            $allowed[] = $route->method;
        }
        if ($allowed !== []) {
            throw new MethodNotAllowedException(array_values(array_unique($allowed)));
        }
        throw new NotFoundException('The requested endpoint does not exist.');
    }
}
