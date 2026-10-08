<?php

declare(strict_types=1);

namespace App\Exceptions;

final class ConflictException extends AppException
{
    public function __construct(string $message = 'The request conflicts with the current state of the resource.', array $fields = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 'CONFLICT', 409, $fields, $previous);
    }
}
