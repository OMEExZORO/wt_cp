<?php

declare(strict_types=1);

namespace App\Exceptions;

final class MethodNotAllowedException extends AppException
{
    public function __construct(private readonly array $allowed)
    {
        parent::__construct('This method is not allowed for this resource.', 'METHOD_NOT_ALLOWED', 405);
    }

    public function allowed(): array
    {
        return $this->allowed;
    }
}
