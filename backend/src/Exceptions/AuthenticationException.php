<?php

declare(strict_types=1);

namespace App\Exceptions;

final class AuthenticationException extends AppException
{
    public function __construct(string $message = 'Please sign in to continue.', array $fields = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 'UNAUTHENTICATED', 401, $fields, $previous);
    }
}
