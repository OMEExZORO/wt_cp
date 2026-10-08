<?php

declare(strict_types=1);

namespace App\Core;

final class Cookie
{
    public function __construct(private readonly Config $config)
    {
    }

    public function set(string $name, string $value, int $expiresAt, bool $httpOnly = true): void
    {
        if (headers_sent()) {
            return;
        }
        setcookie($name, $value, [
            'expires' => $expiresAt,
            'path' => '/',
            'domain' => (string) $this->config->get('session.domain', ''),
            'secure' => (bool) $this->config->get('session.secure', false),
            'httponly' => $httpOnly,
            'samesite' => (string) $this->config->get('session.samesite', 'Lax'),
        ]);
    }

    public function forget(string $name): void
    {
        $this->set($name, '', time() - 3600);
    }
}
