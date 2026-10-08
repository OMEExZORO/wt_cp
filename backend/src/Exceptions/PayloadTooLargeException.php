<?php

declare(strict_types=1);

namespace App\Exceptions;

final class PayloadTooLargeException extends AppException
{
    public function __construct(string $message = 'The request is too large.', array $fields = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, 'PAYLOAD_TOO_LARGE', 413, $fields, $previous);
    }
}
