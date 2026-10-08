<?php

declare(strict_types=1);

namespace App\Exceptions;

final class NotFoundException extends AppException
{
    public function __construct(string $message = 'Resource not found.', array $fields = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 'NOT_FOUND', 404, $fields, $previous);
    }
}
