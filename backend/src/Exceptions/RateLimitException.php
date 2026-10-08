<?php

declare(strict_types=1);

namespace App\Exceptions;

final class RateLimitException extends AppException
{
    public function __construct(
        string $message = 'Too many attempts. Please wait and try again.',
        private readonly int $retryAfterSeconds = 60
    ) {
        parent::__construct($message, 'RATE_LIMITED', 429);
    }

    public function retryAfter(): int
    {
        return max(1, $this->retryAfterSeconds);
    }
}
