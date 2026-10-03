<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

final class Request
{
    private array $body;
    private array $params = [];

    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $query,
        array $body,
        private readonly array $files,
        private readonly array $headers
    ) {
        $this->body = $body;
    }

    public static function capture(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = preg_replace('#^/api#', '', $uri) ?: '/';
        $path = '/' . trim($path, '/');

        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }

        $body = [];
        $contentType = $headers['content-type'] ?? '';
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input', false, null, 0, 1048576);
            $decoded = json_decode($raw ?: '[]', true);
            if (!is_array($decoded)) {
                throw new HttpException(400, 'Malformed JSON body.');
            }
            $body = $decoded;
        } elseif ($method === 'POST') {
            $body = $_POST;
        }

        return new self($method, $path, $_GET, $body, $_FILES, $headers);
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function input(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $this->body;
        }
        return $this->body[$key] ?? $default;
    }

    public function query(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $this->query;
        }
        return $this->query[$key] ?? $default;
    }

    public function file(string $key): ?array
    {
        $file = $this->files[$key] ?? null;
        return is_array($file) && !is_array($file['name'] ?? null) ? $file : null;
    }

    public function setParams(array $params): void
    {
        $this->params = $params;
    }

    public function param(string $key): ?string
    {
        return $this->params[$key] ?? null;
    }

    public function intParam(string $key): int
    {
        $value = $this->param($key);
        if ($value === null || !ctype_digit($value) || (int) $value < 1) {
            throw new HttpException(404, 'Resource not found.');
        }
        return (int) $value;
    }

    public function ip(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
    }
}
