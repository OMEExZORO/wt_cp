<?php

declare(strict_types=1);

namespace App\Exceptions;

final class SlotFullException extends AppException
{
    public function __construct(
        string $message = 'This time slot has just been fully booked. Please choose another time.',
        private readonly ?array $suggestion = null,
        private readonly ?array $slot = null
    ) {
        parent::__construct($message, 'CONFLICT', 409, ['slot_id' => $message]);
    }

    public function suggestion(): ?array
    {
        return $this->suggestion;
    }

    public function slot(): ?array
    {
        return $this->slot;
    }

    public function withSuggestion(?array $suggestion): self
    {
        return new self($this->getMessage(), $suggestion, $this->slot);
    }

    public function extra(): array
    {
        return ['reason' => 'SLOT_FULL', 'suggestion' => $this->suggestion];
    }
}
