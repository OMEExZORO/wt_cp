<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

final class Auth
{
    public const PATIENT = 'patient';
    public const RECEPTIONIST = 'receptionist';
    public const DOCTOR = 'doctor';
    public const REFERRING_DOCTOR = 'referring_doctor';
    public const ROLES = [self::PATIENT, self::RECEPTIONIST, self::DOCTOR, self::REFERRING_DOCTOR];
    public const STAFF_ROLES = [self::RECEPTIONIST, self::DOCTOR];

    private const REMEMBER_COOKIE = 'diagnocare_remember';
    private const MAX_ATTEMPTS = 5;
    private const LOCKOUT_MINUTES = 15;

    private static ?array $user = null;
    private static bool $resolved = false;

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function attempt(string $email, string $password, bool $remember, string $ip): array
    {
        self::guardAgainstBruteForce($email, $ip);

        $user = Database::one('SELECT * FROM users WHERE email = :email LIMIT 1', ['email' => $email]);
        $dummy = '$2y$12$DSKeoMOk2dNiw.RX0XmJHOfQxE8t8IYD..cva6njAAr.vsYm2EQE6';
        $valid = password_verify($password, $user['password_hash'] ?? $dummy) && $user !== null;

        if (!$valid) {
            Database::run('INSERT INTO login_attempts (email, ip_address) VALUES (:email, :ip)', ['email' => $email, 'ip' => $ip]);
            throw new HttpException(401, 'Invalid email or password.');
        }
        if ((int) $user['is_active'] !== 1) {
            throw new HttpException(403, 'Your account is inactive. Please contact the clinic.');
        }

        Database::run('DELETE FROM login_attempts WHERE email = :email', ['email' => $email]);

        if (password_needs_rehash($user['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
            Database::run('UPDATE users SET password_hash = :h WHERE id = :id', ['h' => self::hash($password), 'id' => $user['id']]);
        }

        self::login((int) $user['id'], $remember);
        return self::user();
    }

    public static function login(int $userId, bool $remember): void
    {
        Session::regenerate();
        Session::set('user_id', $userId);
        Csrf::rotate();
        Database::run('UPDATE users SET last_login_at = NOW() WHERE id = :id', ['id' => $userId]);
        if ($remember) {
            self::issueRememberToken($userId);
        }
        self::$resolved = false;
        self::$user = null;
    }

    public static function logout(): void
    {
        $cookie = $_COOKIE[self::REMEMBER_COOKIE] ?? '';
        if (is_string($cookie) && str_contains($cookie, ':')) {
            [$selector] = explode(':', $cookie, 2);
            Database::run('DELETE FROM remember_tokens WHERE selector = :s', ['s' => $selector]);
        }
        $userId = Session::get('user_id');
        if (is_int($userId)) {
            Database::run('DELETE FROM remember_tokens WHERE user_id = :id AND expires_at < NOW()', ['id' => $userId]);
        }
        self::clearRememberCookie();
        Session::destroy();
        self::$user = null;
        self::$resolved = true;
    }

    public static function user(): ?array
    {
        if (self::$resolved) {
            return self::$user;
        }
        self::$resolved = true;

        $userId = Session::get('user_id');
        if (is_int($userId)) {
            self::$user = self::loadActiveUser($userId);
            if (self::$user === null) {
                Session::destroy();
                session_start();
            }
            return self::$user;
        }

        $userId = self::consumeRememberToken();
        if ($userId !== null) {
            Session::regenerate();
            Session::set('user_id', $userId);
            Csrf::rotate();
            self::$user = self::loadActiveUser($userId);
        }
        return self::$user;
    }

    public static function require(string ...$roles): array
    {
        $user = self::user();
        if ($user === null) {
            $message = Session::wasExpired() ? 'Your session has expired. Please log in again.' : 'Please log in to continue.';
            throw new HttpException(401, $message, [], ['code' => Session::wasExpired() ? 'session_expired' : 'unauthenticated']);
        }
        if ($roles !== [] && !in_array($user['role'], $roles, true)) {
            throw new HttpException(403, 'You do not have permission to perform this action.');
        }
        return $user;
    }

    public static function id(): int
    {
        return (int) self::require()['id'];
    }

    private static function loadActiveUser(int $id): ?array
    {
        return Database::one(
            'SELECT id, full_name, email, phone, role, date_of_birth, gender, registration_no, created_at
             FROM users WHERE id = :id AND is_active = 1',
            ['id' => $id]
        );
    }

    private static function guardAgainstBruteForce(string $email, string $ip): void
    {
        $row = Database::one(
            'SELECT
                SUM(email = :email) AS by_email,
                SUM(ip_address = :ip) AS by_ip
             FROM login_attempts
             WHERE attempted_at > (NOW() - INTERVAL :mins MINUTE)
               AND (email = :email2 OR ip_address = :ip2)',
            ['email' => $email, 'ip' => $ip, 'mins' => self::LOCKOUT_MINUTES, 'email2' => $email, 'ip2' => $ip]
        );
        if ((int) ($row['by_email'] ?? 0) >= self::MAX_ATTEMPTS || (int) ($row['by_ip'] ?? 0) >= self::MAX_ATTEMPTS * 4) {
            throw new HttpException(429, 'Too many failed login attempts. Please try again in ' . self::LOCKOUT_MINUTES . ' minutes.');
        }
    }

    private static function issueRememberToken(int $userId): void
    {
        $selector = bin2hex(random_bytes(12));
        $validator = bin2hex(random_bytes(32));
        $days = (int) Config::get('session.remember_days');
        $expires = time() + $days * 86400;

        Database::run(
            'INSERT INTO remember_tokens (user_id, selector, validator_hash, expires_at)
             VALUES (:uid, :sel, :hash, FROM_UNIXTIME(:exp))',
            ['uid' => $userId, 'sel' => $selector, 'hash' => hash('sha256', $validator), 'exp' => $expires]
        );

        setcookie(self::REMEMBER_COOKIE, $selector . ':' . $validator, [
            'expires' => $expires,
            'path' => '/',
            'secure' => (bool) Config::get('session.secure'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private static function consumeRememberToken(): ?int
    {
        $cookie = $_COOKIE[self::REMEMBER_COOKIE] ?? '';
        if (!is_string($cookie) || !preg_match('/^([a-f0-9]{24}):([a-f0-9]{64})$/', $cookie, $m)) {
            if ($cookie !== '') {
                self::clearRememberCookie();
            }
            return null;
        }

        $token = Database::one(
            'SELECT t.id, t.user_id, t.validator_hash FROM remember_tokens t
             JOIN users u ON u.id = t.user_id AND u.is_active = 1
             WHERE t.selector = :s AND t.expires_at > NOW()',
            ['s' => $m[1]]
        );

        if ($token === null || !hash_equals($token['validator_hash'], hash('sha256', $m[2]))) {
            if ($token !== null) {
                Database::run('DELETE FROM remember_tokens WHERE user_id = :uid', ['uid' => $token['user_id']]);
            }
            self::clearRememberCookie();
            return null;
        }

        Database::run('DELETE FROM remember_tokens WHERE id = :id', ['id' => $token['id']]);
        self::issueRememberToken((int) $token['user_id']);
        return (int) $token['user_id'];
    }

    private static function clearRememberCookie(): void
    {
        setcookie(self::REMEMBER_COOKIE, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => (bool) Config::get('session.secure'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}
