<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Request;
use App\Exceptions\ValidationException;
use App\Models\EmailVerification;
use App\Models\User;
use App\Services\Mail\MailService;

final class EmailVerificationService
{
    public function __construct(
        private readonly EmailVerification $verifications,
        private readonly User $users,
        private readonly MailService $mail,
        private readonly AuditLogger $audit,
        private readonly Config $config
    ) {
    }

    public function send(array $user): bool
    {
        $token = bin2hex(random_bytes(32));
        $hours = (int) $this->config->get('auth.verify_token_hours', 48);
        $this->verifications->issue((string) $user['id'], hash('sha256', $token), $hours);
        return $this->mail->sendTemplate((string) $user['email'], (string) $user['full_name'], 'verify-email', [
            'name' => $user['full_name'],
            'link' => $this->config->get('frontend_url') . '/verify-email?token=' . $token,
            'hours' => $hours,
        ]);
    }

    public function verify(string $token, Request $request): array
    {
        $userId = $this->verifications->consume(hash('sha256', $token));
        if ($userId === null) {
            throw ValidationException::withField('token', 'This verification link is invalid or has expired.');
        }
        $this->users->markEmailVerified($userId);
        $user = $this->users->find($userId) ?? [];
        $this->audit->log('auth.email_verified', $request, ['actor' => $user, 'entity_type' => 'user', 'entity_id' => $userId]);
        return $user;
    }
}
