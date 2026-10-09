<?php

declare(strict_types=1);

namespace App\Services\Storage;

interface StorageService
{
    public const PATH_PATTERN = '#^[a-z0-9][a-z0-9/_-]*\.bin$#';

    public function put(string $path, string $contents): void;

    public function get(string $path): string;

    public function delete(string $path): void;

    public function driver(): string;
}
