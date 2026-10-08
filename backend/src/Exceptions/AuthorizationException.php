<?php

declare(strict_types=1);

namespace App\Exceptions;

final class AuthorizationException extends AppException
{
    public function __construct(string $message = 'You do not have permission to perform this action.', array $fields = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 'FORBIDDEN', 403, $fields, $previous);
    }
}
