<?php

declare(strict_types=1);

namespace App\Models;

final class LoginAttempt extends Model
{
    protected const TABLE = 'login_attempts';

    public function record(string $email, ?string $ip, bool $succeeded, ?string $userAgent): void
    {
        $this->execute(
            'INSERT INTO login_attempts (email, ip_address, succeeded, user_agent) VALUES (:email, :ip, :succeeded, :user_agent)',
            ['email' => mb_substr($email, 0, 254), 'ip' => $ip, 'succeeded' => $succeeded, 'user_agent' => $userAgent]
        );
    }

    public function recentFailuresForEmail(string $email, int $minutes): int
    {
        return (int) $this->fetchValue(
            'SELECT count(*) FROM login_attempts
             WHERE lower(email) = lower(:email) AND succeeded = FALSE
               AND attempted_at > now() - make_interval(mins => :minutes)
               AND attempted_at > COALESCE((
                   SELECT max(attempted_at) FROM login_attempts
                   WHERE lower(email) = lower(:email_b) AND succeeded = TRUE
               ), \'-infinity\'::timestamptz)',
            ['email' => $email, 'minutes' => $minutes, 'email_b' => $email]
        );
    }
}
