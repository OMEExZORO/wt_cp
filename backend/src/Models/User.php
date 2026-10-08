<?php

declare(strict_types=1);

namespace App\Models;

final class User extends Model
{
    public const ROLES = ['patient', 'receptionist', 'doctor', 'admin', 'referrer'];

    protected const TABLE = 'users';
    protected const FILLABLE = [
        'email', 'password_hash', 'role', 'full_name', 'phone', 'is_active', 'email_verified_at',
        'password_changed_at', 'consent_given_at', 'consent_version',
    ];

    public function findByEmail(string $email): ?array
    {
        return $this->fetchOne(
            'SELECT *,
                    (locked_until IS NOT NULL AND locked_until > now()) AS is_locked,
                    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (locked_until - now()))))::int AS lock_seconds_remaining
             FROM users WHERE lower(email) = lower(:email)',
            ['email' => $email]
        );
    }

    public function emailExists(string $email): bool
    {
        return (bool) $this->fetchValue('SELECT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(:email))', ['email' => $email]);
    }

    public function registerFailure(string $id, int $maxAttempts, int $lockMinutes): array
    {
        return $this->fetchOne(
            'UPDATE users SET
                failed_login_count = CASE WHEN failed_login_count + 1 >= :max_a THEN 0 ELSE failed_login_count + 1 END,
                locked_until = CASE WHEN failed_login_count + 1 >= :max_b THEN now() + make_interval(mins => :minutes) ELSE locked_until END
             WHERE id = :id
             RETURNING failed_login_count, (locked_until IS NOT NULL AND locked_until > now()) AS is_locked',
            ['max_a' => $maxAttempts, 'max_b' => $maxAttempts, 'minutes' => $lockMinutes, 'id' => $id]
        ) ?? ['failed_login_count' => 0, 'is_locked' => false];
    }

    public function registerSuccess(string $id): void
    {
        $this->execute(
            'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = :id',
            ['id' => $id]
        );
    }

    public function updatePassword(string $id, string $hash, string $changedAt): void
    {
        $this->execute(
            'UPDATE users SET password_hash = :hash, password_changed_at = :changed_at, failed_login_count = 0, locked_until = NULL WHERE id = :id',
            ['hash' => $hash, 'changed_at' => $changedAt, 'id' => $id]
        );
    }

    public function rehash(string $id, string $hash): void
    {
        $this->execute('UPDATE users SET password_hash = :hash WHERE id = :id', ['hash' => $hash, 'id' => $id]);
    }

    public function markEmailVerified(string $id): void
    {
        $this->execute('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = :id', ['id' => $id]);
    }

    public static function toPublic(array $user, ?array $profile = null): array
    {
        return [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'full_name' => $user['full_name'],
            'phone' => $user['phone'] ?? null,
            'email_verified' => !empty($user['email_verified_at']),
            'email_verified_at' => self::iso($user['email_verified_at'] ?? null),
            'last_login_at' => self::iso($user['last_login_at'] ?? null),
            'created_at' => self::iso($user['created_at'] ?? null),
            'profile' => $profile,
        ];
    }
}
