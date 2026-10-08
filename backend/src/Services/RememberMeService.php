<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Cookie;
use App\Core\Request;
use App\Models\Model;
use App\Models\RememberToken;
use App\Models\User;

final class RememberMeService
{
    private const COOKIE_PATTERN = '/^([a-f0-9]{24})\.([a-f0-9]{64})$/';

    public function __construct(
        private readonly RememberToken $tokens,
        private readonly User $users,
        private readonly Cookie $cookie,
        private readonly Config $config,
        private readonly AuditLogger $audit
    ) {
    }

    public function issue(string $userId, Request $request): void
    {
        $selector = bin2hex(random_bytes(12));
        $validator = bin2hex(random_bytes(32));
        $days = $this->days();
        $this->tokens->issue($userId, $selector, hash('sha256', $validator), $days, $request->userAgent(), $request->ip());
        $this->cookie->set($this->cookieName(), $selector . '.' . $validator, time() + $days * 86400);
    }

    public function consume(Request $request): ?array
    {
        $raw = $request->cookie($this->cookieName());
        if ($raw === null) {
            return null;
        }
        if (preg_match(self::COOKIE_PATTERN, $raw, $m) !== 1) {
            $this->cookie->forget($this->cookieName());
            return null;
        }
        [, $selector, $validator] = $m;
        $token = $this->tokens->findBySelector($selector);
        if ($token === null) {
            $this->cookie->forget($this->cookieName());
            return null;
        }
        if (Model::flag($token['is_expired'])) {
            $this->tokens->deleteBySelector($selector);
            $this->cookie->forget($this->cookieName());
            return null;
        }

        $hash = hash('sha256', $validator);
        $user = $this->users->find((string) $token['user_id']);
        if ($user === null || !Model::flag($user['is_active'])) {
            $this->tokens->deleteBySelector($selector);
            $this->cookie->forget($this->cookieName());
            return null;
        }

        if (hash_equals((string) $token['validator_hash'], $hash)) {
            $newValidator = bin2hex(random_bytes(32));
            $days = $this->days();
            $this->tokens->rotate((string) $token['id'], hash('sha256', $newValidator), $hash, $days, $request->userAgent(), $request->ip());
            $this->cookie->set($this->cookieName(), $selector . '.' . $newValidator, time() + $days * 86400);
            return $user;
        }

        if ($token['previous_validator_hash'] !== null
            && Model::flag($token['in_grace'])
            && hash_equals((string) $token['previous_validator_hash'], $hash)) {
            return $user;
        }

        $revoked = $this->tokens->deleteForUser((string) $token['user_id']);
        $this->cookie->forget($this->cookieName());
        $this->audit->log('auth.remember_token_theft', $request, [
            'actor' => $user,
            'entity_type' => 'user',
            'entity_id' => $user['id'],
            'metadata' => ['revoked_tokens' => $revoked],
        ]);
        return null;
    }

    public function forgetCurrent(Request $request): void
    {
        $raw = $request->cookie($this->cookieName());
        if ($raw !== null && preg_match(self::COOKIE_PATTERN, $raw, $m) === 1) {
            $this->tokens->deleteBySelector($m[1]);
        }
        $this->cookie->forget($this->cookieName());
    }

    public function revokeAll(string $userId): int
    {
        return $this->tokens->deleteForUser($userId);
    }

    public function forgetCookie(): void
    {
        $this->cookie->forget($this->cookieName());
    }

    private function cookieName(): string
    {
        return (string) $this->config->get('remember.cookie', 'dc_remember');
    }

    private function days(): int
    {
        return max(1, (int) $this->config->get('remember.days', 30));
    }
}
