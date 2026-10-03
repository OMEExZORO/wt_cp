<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

final class Config
{
    private static array $config = [];

    public static function set(array $config): void
    {
        self::$config = $config;
    }

    public static function get(string $path, mixed $default = null): mixed
    {
        $value = self::$config;
        foreach (explode('.', $path) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }
        return $value;
    }
}
