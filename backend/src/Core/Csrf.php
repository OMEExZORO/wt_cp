<?php

declare(strict_types=1);

namespace App\Core;

final class Csrf
{
    public const HEADER = 'X-CSRF-Token';
    private const SESSION_KEY = '_csrf_seed';

    public function __construct(private readonly Session $session)
    {
    }

    public function token(): string
    {
        $seed = $this->session->get(self::SESSION_KEY);
        if (!is_string($seed) || $seed === '') {
            $seed = bin2hex(random_bytes(32));
            $this->session->set(self::SESSION_KEY, $seed);
        }
        return $this->sign($seed);
    }

    public function validate(?string $token): bool
    {
        $seed = $this->session->get(self::SESSION_KEY);
        if (!is_string($seed) || $seed === '' || $token === null || $token === '') {
            return false;
        }
        return hash_equals($this->sign($seed), $token);
    }

    public function rotate(): string
    {
        $this->session->remove(self::SESSION_KEY);
        return $this->token();
    }

    private function sign(string $seed): string
    {
        return hash_hmac('sha256', $seed, Env::require('CSRF_SECRET'));
    }
}
