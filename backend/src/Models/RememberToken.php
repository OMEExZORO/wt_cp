<?php

declare(strict_types=1);

namespace App\Models;

final class RememberToken extends Model
{
    protected const TABLE = 'remember_tokens';
    protected const FILLABLE = ['user_id', 'selector', 'validator_hash', 'expires_at', 'user_agent', 'ip_address'];

    public function findBySelector(string $selector): ?array
    {
        return $this->fetchOne(
            'SELECT *,
                    (expires_at <= now()) AS is_expired,
                    (rotated_at IS NOT NULL AND rotated_at > now() - make_interval(secs => :grace)) AS in_grace
             FROM remember_tokens WHERE selector = :selector',
            ['selector' => $selector, 'grace' => 60]
        );
    }

    public function issue(string $userId, string $selector, string $validatorHash, int $days, ?string $userAgent, ?string $ip): void
    {
        $this->execute(
            'INSERT INTO remember_tokens (user_id, selector, validator_hash, expires_at, user_agent, ip_address)
             VALUES (:user_id, :selector, :validator_hash, now() + make_interval(days => :days), :user_agent, :ip_address)',
            [
                'user_id' => $userId,
                'selector' => $selector,
                'validator_hash' => $validatorHash,
                'days' => $days,
                'user_agent' => $userAgent,
                'ip_address' => $ip,
            ]
        );
    }

    public function rotate(string $id, string $newHash, string $previousHash, int $days, ?string $userAgent, ?string $ip): void
    {
        $this->execute(
            'UPDATE remember_tokens
             SET validator_hash = :new_hash, previous_validator_hash = :previous_hash, rotated_at = now(),
                 last_used_at = now(), expires_at = now() + make_interval(days => :days),
                 user_agent = :user_agent, ip_address = :ip_address
             WHERE id = :id',
            [
                'new_hash' => $newHash,
                'previous_hash' => $previousHash,
                'days' => $days,
                'user_agent' => $userAgent,
                'ip_address' => $ip,
                'id' => $id,
            ]
        );
    }

    public function deleteBySelector(string $selector): void
    {
        $this->execute('DELETE FROM remember_tokens WHERE selector = :selector', ['selector' => $selector]);
    }

    public function deleteForUser(string $userId): int
    {
        return $this->execute('DELETE FROM remember_tokens WHERE user_id = :user_id', ['user_id' => $userId]);
    }

    public function countForUser(string $userId): int
    {
        return (int) $this->fetchValue('SELECT count(*) FROM remember_tokens WHERE user_id = :user_id', ['user_id' => $userId]);
    }
}
