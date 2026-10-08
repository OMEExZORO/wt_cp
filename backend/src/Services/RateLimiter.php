<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\RateLimitException;
use App\Models\RateLimit;

final class RateLimiter
{
    public function __construct(private readonly RateLimit $limits)
    {
    }

    public function attempt(string $bucket, int $max, int $windowSeconds, ?string $message = null): void
    {
        $bucket = mb_substr($bucket, 0, 200);
        $result = $this->limits->hit($bucket, $windowSeconds);
        if ((int) $result['hits'] > $max) {
            throw new RateLimitException(
                $message ?? 'Too many requests. Please wait a few minutes and try again.',
                (int) $result['retry_after']
            );
        }
    }

    public function clear(string $bucket): void
    {
        $this->limits->clear(mb_substr($bucket, 0, 200));
    }
}
