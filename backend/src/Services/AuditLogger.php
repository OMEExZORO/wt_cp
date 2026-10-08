<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Request;

interface AuditLogger
{
    public function log(string $action, ?Request $request = null, array $options = []): void;
}
