<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Services\Storage\StorageService;

final class InMemoryStorage implements StorageService
{
    public array $objects = [];

    public function put(string $path, string $contents): void
    {
        $this->objects[$path] = $contents;
    }

    public function get(string $path): string
    {
        return $this->objects[$path] ?? throw new \App\Exceptions\StorageException('missing');
    }

    public function delete(string $path): void
    {
        unset($this->objects[$path]);
    }

    public function driver(): string
    {
        return 'local';
    }
}
