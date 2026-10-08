<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Request;
use App\Core\Session;
use App\Exceptions\AuthenticationException;
use App\Exceptions\RateLimitException;
use App\Models\LoginAttempt;
use App\Models\Model;
use App\Models\Patient;
use App\Models\Referrer;
use App\Models\User;

final class AuthService
{
    private const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=1$QnJsOU0waDZXRC5KN0VKaA$CDwCSZ8zD7Ib0S7ObUWOTwrxhs35Ij6p/qiEwSWqqic';
    private const GENERIC_FAILURE = 'Incorrect email or password.';

    public function __construct(
        private readonly User $users,
        private readonly Patient $patients,
        private readonly Referrer $referrers,
        private readonly LoginAttempt $attempts,
        private readonly Session $session,
        private readonly RememberMeService $remember,
        private readonly AuditLogger $audit,
        private readonly Config $config
    ) {
    }

    public function resolveUser(Request $request): ?array
    {
        $userId = $this->session->get('user_id');
        if (is_string($userId)) {
            $user = $this->users->find($userId);
            if ($user !== null && $this->sessionStillValid($user)) {
                return $user;
            }
            $this->clearSessionAuth();
        }
        $user = $this->remember->consume($request);
        if ($user === null) {
            return null;
        }
        $this->startSession($user);
        $this->audit->log('auth.remember_login', $request, ['actor' => $user, 'entity_type' => 'user', 'entity_id' => $user['id']]);
        return $user;
    }

    public function login(string $email, string $password, bool $remember, Request $request): array
    {
        $maxAttempts = (int) $this->config->get('auth.max_failed_attempts', 5);
        $lockMinutes = (int) $this->config->get('auth.lockout_minutes', 15);
        $user = $this->users->findByEmail($email);

        if ($user !== null && Model::flag($user['is_locked'])) {
            $this->attempts->record($email, $request->ip(), false, $request->userAgent());
            $this->audit->log('auth.login_blocked', $request, ['entity_type' => 'user', 'entity_id' => $user['id']]);
            throw $this->lockedException((int) $user['lock_seconds_remaining']);
        }
        if ($user === null && $this->attempts->recentFailuresForEmail($email, $lockMinutes) >= $maxAttempts) {
            $this->attempts->record($email, $request->ip(), false, $request->userAgent());
            throw $this->lockedException($lockMinutes * 60);
        }

        $valid = password_verify($password, $user['password_hash'] ?? self::DUMMY_HASH);

        if ($user === null || !$valid || !Model::flag($user['is_active'])) {
            $this->attempts->record($email, $request->ip(), false, $request->userAgent());
            $metadata = ['email' => $email, 'reason' => $user === null ? 'unknown_email' : (!$valid ? 'bad_password' : 'inactive')];
            if ($user !== null && !$valid) {
                $state = $this->users->registerFailure((string) $user['id'], $maxAttempts, $lockMinutes);
                if (Model::flag($state['is_locked'])) {
                    $this->audit->log('auth.account_locked', $request, ['entity_type' => 'user', 'entity_id' => $user['id'], 'metadata' => ['minutes' => $lockMinutes]]);
                    $this->audit->log('auth.login_failed', $request, ['entity_type' => 'user', 'entity_id' => $user['id'], 'metadata' => $metadata]);
                    throw $this->lockedException($lockMinutes * 60);
                }
            }
            $this->audit->log('auth.login_failed', $request, [
                'entity_type' => 'user',
                'entity_id' => $user['id'] ?? null,
                'metadata' => $metadata,
            ]);
            throw new AuthenticationException(self::GENERIC_FAILURE);
        }

        if ((bool) $this->config->get('auth.require_verified_email_for_login', false) && empty($user['email_verified_at'])) {
            throw new AuthenticationException('Please verify your email address before signing in.');
        }

        if (password_needs_rehash((string) $user['password_hash'], PASSWORD_ARGON2ID)) {
            $this->users->rehash((string) $user['id'], password_hash($password, PASSWORD_ARGON2ID));
        }

        $this->users->registerSuccess((string) $user['id']);
        $this->attempts->record($email, $request->ip(), true, $request->userAgent());
        $this->remember->forgetCurrent($request);
        $this->startSession($user);
        if ($remember) {
            $this->remember->issue((string) $user['id'], $request);
        }
        $this->audit->log('auth.login_succeeded', $request, [
            'actor' => $user,
            'entity_type' => 'user',
            'entity_id' => $user['id'],
            'metadata' => ['remember' => $remember],
        ]);
        return $this->users->find((string) $user['id']) ?? $user;
    }

    public function startSession(array $user): void
    {
        $this->session->regenerate();
        $this->session->set('user_id', (string) $user['id']);
        $this->session->set('role', (string) $user['role']);
        $this->session->set('auth_time', time());
    }

    public function refreshAuthTime(int $timestamp): void
    {
        $this->session->regenerate();
        $this->session->set('auth_time', $timestamp);
    }

    public function logout(Request $request): void
    {
        $user = $request->user();
        $this->remember->forgetCurrent($request);
        $this->session->destroy();
        if ($user !== null) {
            $this->audit->log('auth.logout', $request, ['actor' => $user, 'entity_type' => 'user', 'entity_id' => $user['id']]);
        }
    }

    public function logoutEverywhere(Request $request, array $user): int
    {
        $revoked = $this->remember->revokeAll((string) $user['id']);
        $this->remember->forgetCookie();
        $this->session->destroy();
        $this->audit->log('auth.logout_all', $request, [
            'actor' => $user,
            'entity_type' => 'user',
            'entity_id' => $user['id'],
            'metadata' => ['revoked_tokens' => $revoked],
        ]);
        return $revoked;
    }

    public function present(array $user): array
    {
        $profile = match ($user['role']) {
            'patient' => ($p = $this->patients->findByUserId((string) $user['id'])) !== null ? Patient::toPublic($p) : null,
            'referrer' => ($r = $this->referrers->findByUserId((string) $user['id'])) !== null ? Referrer::toPublic($r) : null,
            default => null,
        };
        return User::toPublic($user, $profile);
    }

    private function sessionStillValid(array $user): bool
    {
        if (!Model::flag($user['is_active'])) {
            return false;
        }
        if ($this->session->get('role') !== $user['role']) {
            return false;
        }
        $authTime = $this->session->get('auth_time');
        if (!is_int($authTime)) {
            return false;
        }
        if (!empty($user['password_changed_at'])) {
            $changed = strtotime((string) $user['password_changed_at']);
            if ($changed !== false && $changed > $authTime) {
                return false;
            }
        }
        return true;
    }

    private function clearSessionAuth(): void
    {
        $this->session->remove('user_id');
        $this->session->remove('role');
        $this->session->remove('auth_time');
        $this->session->regenerate();
    }

    private function lockedException(int $seconds): RateLimitException
    {
        $minutes = max(1, (int) ceil($seconds / 60));
        return new RateLimitException(
            sprintf('Too many failed sign-in attempts. Please try again in %d minute%s.', $minutes, $minutes === 1 ? '' : 's'),
            max(1, $seconds)
        );
    }
}
