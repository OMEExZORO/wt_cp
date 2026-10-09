<?php

declare(strict_types=1);

namespace App\Services\Alerts;

use App\Services\EncryptionService;

final class EncryptedNoteProtector implements NoteProtector
{
    public function __construct(private readonly EncryptionService $encryption)
    {
    }

    public function available(): bool
    {
        return true;
    }

    public function protect(string $plain): string
    {
        return $this->encryption->encryptText($plain);
    }
}
