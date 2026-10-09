<?php

declare(strict_types=1);

namespace App\Services\Alerts;

final class UnavailableNoteProtector implements NoteProtector
{
    public function available(): bool
    {
        return false;
    }

    public function protect(string $plain): string
    {
        throw new \LogicException('No encryption service is available');
    }
}
