<?php

declare(strict_types=1);

namespace App\Exceptions;

final class CsrfException extends AppException
{
    public function __construct(string $message = 'Your session security token is missing or expired. Please retry.', array $fields = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 'CSRF_INVALID', 419, $fields, $previous);
    }
}
