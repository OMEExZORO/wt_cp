<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

final class Session
{
    private static bool $expired = false;

    public static function start(): void
    {
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.gc_maxlifetime', (string) Config::get('session.absolute_timeout'));

        session_name(Config::get('session.name'));
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => (bool) Config::get('session.secure'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();

        $now = time();
        $idle = (int) Config::get('session.idle_timeout');
        $absolute = (int) Config::get('session.absolute_timeout');
        $lastActivity = $_SESSION['last_activity'] ?? null;
        $createdAt = $_SESSION['created_at'] ?? null;

        if (
            ($lastActivity !== null && $now - $lastActivity > $idle)
            || ($createdAt !== null && $now - $createdAt > $absolute)
        ) {
            self::$expired = isset($_SESSION['user_id']);
            self::destroy();
            session_start();
        }

        $_SESSION['created_at'] ??= $now;
        $_SESSION['last_activity'] = $now;
    }

    public static function wasExpired(): bool
    {
        return self::$expired;
    }

    public static function regenerate(): void
    {
        session_regenerate_id(true);
        $_SESSION['created_at'] = time();
        $_SESSION['last_activity'] = time();
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'secure' => $params['secure'],
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            session_destroy();
        }
    }
}
