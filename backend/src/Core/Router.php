<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

final class Router
{
    private array $routes = [];

    public function get(string $path, array $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    public function post(string $path, array $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    public function put(string $path, array $handler): void
    {
        $this->add('PUT', $path, $handler);
    }

    public function patch(string $path, array $handler): void
    {
        $this->add('PATCH', $path, $handler);
    }

    public function delete(string $path, array $handler): void
    {
        $this->add('DELETE', $path, $handler);
    }

    private function add(string $method, string $path, array $handler): void
    {
        $pattern = preg_replace('#\{([a-z_]+)\}#', '(?P<$1>[0-9]+)', $path);
        $this->routes[] = [$method, '#^' . $pattern . '$#', $handler];
    }

    public function dispatch(Request $request): never
    {
        $allowed = [];
        foreach ($this->routes as [$method, $pattern, $handler]) {
            if (!preg_match($pattern, $request->path(), $matches)) {
                continue;
            }
            if ($method !== $request->method()) {
                $allowed[] = $method;
                continue;
            }
            $request->setParams(array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY));
            [$class, $action] = $handler;
            (new $class())->$action($request);
            Response::ok();
        }
        if ($allowed !== []) {
            header('Allow: ' . implode(', ', array_unique($allowed)));
            throw new HttpException(405, 'Method not allowed.');
        }
        throw new HttpException(404, 'Endpoint not found.');
    }
}
