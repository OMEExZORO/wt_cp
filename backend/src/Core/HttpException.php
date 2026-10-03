<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

use RuntimeException;

class HttpException extends RuntimeException
{
    public function __construct(
        private readonly int $status,
        string $message,
        private readonly array $errors = [],
        private readonly array $extra = []
    ) {
        parent::__construct($message, $status);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function errors(): array
    {
        return $this->errors;
    }

    public function extra(): array
    {
        return $this->extra;
    }
}
