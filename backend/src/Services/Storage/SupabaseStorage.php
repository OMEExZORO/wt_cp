<?php

declare(strict_types=1);

namespace App\Services\Storage;

use App\Exceptions\StorageException;

final class SupabaseStorage implements StorageService
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $serviceKey,
        private readonly string $bucket,
        private readonly int $timeoutSeconds = 60
    ) {
    }

    public function put(string $path, string $contents): void
    {
        [$status] = $this->request('POST', $path, $contents, ['Content-Type: application/octet-stream', 'x-upsert: false']);
        if ($status !== 200 && $status !== 201) {
            throw new StorageException(sprintf('Storage upload failed (HTTP %d).', $status));
        }
    }

    public function get(string $path): string
    {
        [$status, $body] = $this->request('GET', $path);
        if ($status !== 200) {
            throw new StorageException(sprintf('Storage download failed (HTTP %d).', $status));
        }
        return $body;
    }

    public function delete(string $path): void
    {
        [$status] = $this->request('DELETE', $path);
        if ($status !== 200 && $status !== 204 && $status !== 404) {
            throw new StorageException(sprintf('Storage delete failed (HTTP %d).', $status));
        }
    }

    public function driver(): string
    {
        return 'supabase';
    }

    private function request(string $method, string $path, ?string $body = null, array $headers = []): array
    {
        if (preg_match(self::PATH_PATTERN, $path) !== 1 || str_contains($path, '..')) {
            throw new StorageException('Invalid storage path.');
        }
        $url = rtrim($this->baseUrl, '/') . '/storage/v1/object/' . rawurlencode($this->bucket) . '/' . $path;
        $handle = curl_init($url);
        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => array_merge(['Authorization: Bearer ' . $this->serviceKey, 'apikey: ' . $this->serviceKey], $headers),
        ];
        if ($body !== null) {
            $options[CURLOPT_POSTFIELDS] = $body;
        }
        curl_setopt_array($handle, $options);
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $failed = $response === false;
        curl_close($handle);
        if ($failed) {
            throw new StorageException('Storage is unreachable.');
        }
        return [$status, (string) $response];
    }
}
