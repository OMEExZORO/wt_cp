<?php

declare(strict_types=1);

namespace App\Exceptions;

final class ValidationException extends AppException
{
    public function __construct(array $fields, string $message = 'Please correct the highlighted fields.', private readonly array $threats = [])
    {
        parent::__construct($message, 'VALIDATION_FAILED', 422, $fields);
    }

    public static function withField(string $field, string $message): self
    {
        return new self([$field => $message]);
    }

    public function threats(): array
    {
        return $this->threats;
    }
}
