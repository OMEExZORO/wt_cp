<?php

declare(strict_types=1);

namespace App\Services\Alerts;

interface NoteProtector
{
    public function available(): bool;

    public function protect(string $plain): string;
}
