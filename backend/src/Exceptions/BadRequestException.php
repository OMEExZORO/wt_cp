<?php

declare(strict_types=1);

namespace App\Exceptions;

final class BadRequestException extends AppException
{
    public function __construct(string $message = 'The request could not be understood.', array $fields = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 'BAD_REQUEST', 400, $fields, $previous);
    }
}
