<?php

declare(strict_types=1);

namespace App\Services\Storage;

use App\Exceptions\StorageException;

final class LocalStorage implements StorageService
{
    public function __construct(private readonly string $root)
    {
    }

    public function put(string $path, string $contents): void
    {
        $target = $this->resolve($path);
        $directory = dirname($target);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new StorageException('Could not create the storage directory.');
        }
        if (is_file($target) || file_put_contents($target, $contents, LOCK_EX) !== strlen($contents)) {
            throw new StorageException('Could not store the file.');
        }
        @chmod($target, 0600);
    }

    public function get(string $path): string
    {
        $target = $this->resolve($path);
        $contents = is_file($target) ? file_get_contents($target) : false;
        if ($contents === false) {
            throw new StorageException('Stored file is missing.');
        }
        return $contents;
    }

    public function delete(string $path): void
    {
        $target = $this->resolve($path);
        if (is_file($target) && !unlink($target)) {
            throw new StorageException('Could not delete the stored file.');
        }
    }

    public function driver(): string
    {
        return 'local';
    }

    private function resolve(string $path): string
    {
        if (preg_match(self::PATH_PATTERN, $path) !== 1 || str_contains($path, '..')) {
            throw new StorageException('Invalid storage path.');
        }
        return rtrim($this->root, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
    }
}
