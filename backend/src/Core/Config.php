<?php

declare(strict_types=1);

namespace App\Core;

final class Config
{
    public function __construct(private array $items = [])
    {
    }

    public static function fromFile(string $path): self
    {
        return new self(require $path);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $value = $this->items;
        foreach (explode('.', $key) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }
        return $value;
    }

    public function set(string $key, mixed $value): void
    {
        $segments = explode('.', $key);
        $target = &$this->items;
        foreach ($segments as $segment) {
            if (!isset($target[$segment]) || !is_array($target[$segment])) {
                $target[$segment] = [];
            }
            $target = &$target[$segment];
        }
        $target = $value;
    }

    public function isProduction(): bool
    {
        return $this->get('env') === 'production';
    }

    public function all(): array
    {
        return $this->items;
    }
}
