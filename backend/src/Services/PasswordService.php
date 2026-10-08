<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Request;
use App\Exceptions\ValidationException;
use App\Models\Model;
use App\Models\PasswordReset;
use App\Models\User;
use App\Services\Mail\MailService;

final class PasswordService
{
    public function __construct(
        private readonly User $users,
        private readonly PasswordReset $resets,
        private readonly RememberMeService $remember,
        private readonly AuthService $auth,
        private readonly RateLimiter $limiter,
        private readonly MailService $mail,
        private readonly AuditLogger $audit,
        private readonly Config $config
    ) {
    }

    public function requestReset(string $email, Request $request): void
    {
        $this->limiter->attempt('forgot-email:' . hash('sha256', $email), 3, 3600, 'Too many reset requests. Please wait and try again.');
        $user = $this->users->findByEmail($email);
        if ($user === null || !Model::flag($user['is_active'])) {
            $this->audit->log('auth.password_reset_requested', $request, ['metadata' => ['email_found' => false]]);
            return;
        }
        $token = bin2hex(random_bytes(32));
        $minutes = (int) $this->config->get('auth.reset_token_minutes', 60);
        $this->resets->issue((string) $user['id'], hash('sha256', $token), $minutes, $request->ip());
        $this->mail->sendTemplate((string) $user['email'], (string) $user['full_name'], 'password-reset', [
            'name' => $user['full_name'],
            'link' => $this->config->get('frontend_url') . '/reset-password?token=' . $token,
            'minutes' => $minutes,
        ]);
        $this->audit->log('auth.password_reset_requested', $request, [
            'entity_type' => 'user',
            'entity_id' => $user['id'],
            'metadata' => ['email_found' => true],
        ]);
    }

    public function reset(string $token, string $password, Request $request): void
    {
        $userId = $this->resets->consume(hash('sha256', $token));
        if ($userId === null) {
            throw ValidationException::withField('token', 'This reset link is invalid or has expired. Please request a new one.');
        }
        $user = $this->users->find($userId);
        if ($user === null) {
            throw ValidationException::withField('token', 'This reset link is invalid or has expired. Please request a new one.');
        }
        $changedAt = $this->store($user, $password);
        $this->notifyChanged($user, $changedAt);
        $this->audit->log('auth.password_reset', $request, ['actor' => $user, 'entity_type' => 'user', 'entity_id' => $userId]);
    }

    public function change(array $user, string $current, string $new, Request $request): void
    {
        if (!password_verify($current, (string) $user['password_hash'])) {
            $this->audit->log('auth.password_change_failed', $request, ['entity_type' => 'user', 'entity_id' => $user['id']]);
            throw ValidationException::withField('current_password', 'Your current password is incorrect.');
        }
        if (password_verify($new, (string) $user['password_hash'])) {
            throw ValidationException::withField('password', 'Choose a password different from your current one.');
        }
        $changedAt = $this->store($user, $new);
        $this->auth->refreshAuthTime(strtotime($changedAt) ?: time());
        $this->notifyChanged($user, $changedAt);
        $this->audit->log('auth.password_changed', $request, ['entity_type' => 'user', 'entity_id' => $user['id']]);
    }

    private function store(array $user, string $password): string
    {
        $changedAt = date('Y-m-d H:i:sP');
        $this->users->updatePassword((string) $user['id'], password_hash($password, PASSWORD_ARGON2ID), $changedAt);
        $this->remember->revokeAll((string) $user['id']);
        $this->remember->forgetCookie();
        return $changedAt;
    }

    private function notifyChanged(array $user, string $changedAt): void
    {
        $this->mail->sendTemplate((string) $user['email'], (string) $user['full_name'], 'password-changed', [
            'name' => $user['full_name'],
            'changed_at' => date('d M Y, h:i A', strtotime($changedAt) ?: time()),
            'reset_link' => $this->config->get('frontend_url') . '/forgot-password',
        ]);
    }
}
