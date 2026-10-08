<?php

declare(strict_types=1);

namespace App\Exceptions;

class AppException extends \RuntimeException
{
    public function __construct(
        string $message,
        private readonly string $errorCode = 'APP_ERROR',
        private readonly int $status = 500,
        private readonly array $fields = [],
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    public function status(): int
    {
        return $this->status;
    }

    public function fields(): array
    {
        return $this->fields;
    }
}
