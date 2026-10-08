<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Core\Request;
use App\Services\AuditLogger;

final class InMemoryAuditLogger implements AuditLogger
{
    public array $entries = [];

    public function log(string $action, ?Request $request = null, array $options = []): void
    {
        $this->entries[] = ['action' => $action, 'options' => $options, 'path' => $request?->path()];
    }

    public function actions(): array
    {
        return array_column($this->entries, 'action');
    }
}
