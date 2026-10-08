<?php

declare(strict_types=1);

namespace App\Core;

final class MiddlewareResolver
{
    public function __construct(private readonly Container $container, private readonly array $aliases = [])
    {
    }

    public function resolve(string|Middleware $spec): array
    {
        if ($spec instanceof Middleware) {
            return [$spec, []];
        }
        $name = $spec;
        $params = [];
        if (str_contains($spec, ':')) {
            [$name, $paramString] = explode(':', $spec, 2);
            $params = array_values(array_filter(
                array_map('trim', explode(',', $paramString)),
                static fn (string $p): bool => $p !== ''
            ));
        }
        $class = $this->aliases[$name] ?? $name;
        if (!class_exists($class)) {
            throw new \InvalidArgumentException(sprintf('Unknown middleware %s', $name));
        }
        $instance = $this->container->get($class);
        if (!$instance instanceof Middleware) {
            throw new \InvalidArgumentException(sprintf('%s is not a middleware', $class));
        }
        return [$instance, $params];
    }
}
