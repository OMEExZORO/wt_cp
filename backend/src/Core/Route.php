<?php

declare(strict_types=1);

namespace App\Core;

final class Route
{
    private const TYPES = [
        'uuid' => '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
        'int' => '[0-9]+',
        'slug' => '[a-z0-9]+(?:-[a-z0-9]+)*',
    ];

    private string $regex;
    private array $paramNames = [];

    public function __construct(
        public readonly string $method,
        public readonly string $pattern,
        public readonly mixed $handler,
        public readonly array $middleware = []
    ) {
        $this->regex = $this->compile($pattern);
    }

    public function match(string $path): ?array
    {
        if (preg_match($this->regex, $path, $matches) !== 1) {
            return null;
        }
        $params = [];
        foreach ($this->paramNames as $name) {
            $params[$name] = rawurldecode($matches[$name]);
        }
        return $params;
    }

    private function compile(string $pattern): string
    {
        $parts = preg_split('/(\{[a-zA-Z_][a-zA-Z0-9_]*(?::[a-z]+)?\})/', $pattern, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];
        $regex = '';
        foreach ($parts as $part) {
            if (preg_match('/^\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-z]+))?\}$/', $part, $m) === 1) {
                $name = $m[1];
                $type = $m[2] ?? null;
                if ($type !== null && !isset(self::TYPES[$type])) {
                    throw new \InvalidArgumentException(sprintf('Unknown route parameter type %s', $type));
                }
                $this->paramNames[] = $name;
                $regex .= '(?P<' . $name . '>' . ($type !== null ? self::TYPES[$type] : '[^/]+') . ')';
                continue;
            }
            $regex .= preg_quote($part, '#');
        }
        return '#^' . $regex . '$#';
    }
}
