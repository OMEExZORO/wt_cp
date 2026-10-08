<?php

declare(strict_types=1);

namespace App\Models;

final class PasswordReset extends Model
{
    protected const TABLE = 'password_resets';

    public function issue(string $userId, string $tokenHash, int $minutes, ?string $ip): void
    {
        $this->execute(
            'UPDATE password_resets SET used_at = now() WHERE user_id = :user_id AND used_at IS NULL',
            ['user_id' => $userId]
        );
        $this->execute(
            'INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
             VALUES (:user_id, :token_hash, now() + make_interval(mins => :minutes), :ip)',
            ['user_id' => $userId, 'token_hash' => $tokenHash, 'minutes' => $minutes, 'ip' => $ip]
        );
    }

    public function consume(string $tokenHash): ?string
    {
        $userId = $this->fetchValue(
            'UPDATE password_resets SET used_at = now()
             WHERE token_hash = :token_hash AND used_at IS NULL AND expires_at > now()
             RETURNING user_id',
            ['token_hash' => $tokenHash]
        );
        return $userId === null ? null : (string) $userId;
    }
}
