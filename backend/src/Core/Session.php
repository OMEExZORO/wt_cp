<?php

declare(strict_types=1);

namespace App\Core;

final class Session
{
    private bool $expired = false;

    public function __construct(private readonly Config $config)
    {
    }

    public function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $savePath = (string) $this->config->get('session.save_path');
        if ($savePath !== '' && !is_dir($savePath)) {
            @mkdir($savePath, 0770, true);
        }
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.gc_maxlifetime', (string) ($this->absoluteSeconds()));
        if ($savePath !== '') {
            session_save_path($savePath);
        }
        session_name((string) $this->config->get('session.name', 'dc_session'));
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => (string) $this->config->get('session.domain', ''),
            'secure' => (bool) $this->config->get('session.secure', false),
            'httponly' => true,
            'samesite' => (string) $this->config->get('session.samesite', 'Lax'),
        ]);
        session_start();
        $this->enforceLifetime();
    }

    private function enforceLifetime(): void
    {
        $now = time();
        $idle = (int) $this->config->get('session.idle_minutes', 30) * 60;
        $lastActivity = $_SESSION['_last_activity'] ?? null;
        $createdAt = $_SESSION['_created_at'] ?? null;
        $idleExpired = is_int($lastActivity) && $now - $lastActivity > $idle;
        $absoluteExpired = is_int($createdAt) && $now - $createdAt > $this->absoluteSeconds();
        if ($idleExpired || $absoluteExpired) {
            $this->expired = isset($_SESSION['user_id']);
            $_SESSION = [];
            session_regenerate_id(true);
            $createdAt = null;
        }
        $_SESSION['_created_at'] = is_int($createdAt) ? $createdAt : $now;
        $_SESSION['_last_activity'] = $now;
    }

    private function absoluteSeconds(): int
    {
        return max(1, (int) $this->config->get('session.absolute_hours', 12)) * 3600;
    }

    public function wasExpired(): bool
    {
        return $this->expired;
    }

    public function isActive(): bool
    {
        return session_status() === PHP_SESSION_ACTIVE;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    public function remove(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public function regenerate(): void
    {
        if ($this->isActive()) {
            session_regenerate_id(true);
            $_SESSION['_created_at'] = time();
            $_SESSION['_last_activity'] = time();
        }
    }

    public function destroy(): void
    {
        if (!$this->isActive()) {
            return;
        }
        $_SESSION = [];
        $params = session_get_cookie_params();
        if (!headers_sent()) {
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();
    }

    public function idleSeconds(): int
    {
        return (int) $this->config->get('session.idle_minutes', 30) * 60;
    }
}
