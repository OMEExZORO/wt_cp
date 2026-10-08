<?php

declare(strict_types=1);

namespace App\Models;

final class EmailVerification extends Model
{
    protected const TABLE = 'email_verifications';

    public function issue(string $userId, string $tokenHash, int $hours): void
    {
        $this->execute(
            'UPDATE email_verifications SET used_at = now() WHERE user_id = :user_id AND used_at IS NULL',
            ['user_id' => $userId]
        );
        $this->execute(
            'INSERT INTO email_verifications (user_id, token_hash, expires_at)
             VALUES (:user_id, :token_hash, now() + make_interval(hours => :hours))',
            ['user_id' => $userId, 'token_hash' => $tokenHash, 'hours' => $hours]
        );
    }

    public function consume(string $tokenHash): ?string
    {
        $userId = $this->fetchValue(
            'UPDATE email_verifications SET used_at = now()
             WHERE token_hash = :token_hash AND used_at IS NULL AND expires_at > now()
             RETURNING user_id',
            ['token_hash' => $tokenHash]
        );
        return $userId === null ? null : (string) $userId;
    }
}
