<?php

declare(strict_types=1);

namespace App\Core;

use App\Exceptions\BadRequestException;

final class Request
{
    private array $attributes = [];
    private ?array $parsedBody = null;

    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $query = [],
        private readonly array $headers = [],
        private readonly string $rawBody = '',
        private readonly array $formBody = [],
        private readonly array $cookies = [],
        private readonly array $files = [],
        private readonly ?string $ip = null
    ) {
    }

    public static function fromGlobals(bool $trustProxy = false): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }
        if (isset($_SERVER['CONTENT_LENGTH'])) {
            $headers['content-length'] = (string) $_SERVER['CONTENT_LENGTH'];
        }
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        if ($trustProxy && isset($headers['x-forwarded-for'])) {
            $forwarded = trim(explode(',', $headers['x-forwarded-for'])[0]);
            $ip = $forwarded !== '' ? $forwarded : $ip;
        }
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $path,
            $_GET,
            $headers,
            (string) file_get_contents('php://input'),
            $_POST,
            $_COOKIE,
            $_FILES,
            is_string($ip) && filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : null
        );
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        $trimmed = rtrim($this->path, '/');
        return $trimmed === '' ? '/' : $trimmed;
    }

    public function isMethodSafe(): bool
    {
        return in_array($this->method, ['GET', 'HEAD', 'OPTIONS'], true);
    }

    public function header(string $name, ?string $default = null): ?string
    {
        return $this->headers[strtolower($name)] ?? $default;
    }

    public function headers(): array
    {
        return $this->headers;
    }

    public function query(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $this->query;
        }
        return $this->query[$key] ?? $default;
    }

    public function cookie(string $name): ?string
    {
        $value = $this->cookies[$name] ?? null;
        return is_string($value) ? $value : null;
    }

    public function files(): array
    {
        return $this->files;
    }

    public function ip(): ?string
    {
        return $this->ip;
    }

    public function userAgent(): ?string
    {
        $agent = $this->header('user-agent');
        return $agent === null ? null : mb_substr($agent, 0, 500);
    }

    public function body(): array
    {
        if ($this->parsedBody !== null) {
            return $this->parsedBody;
        }
        $contentType = strtolower($this->header('content-type', ''));
        if (str_contains($contentType, 'application/json')) {
            if (trim($this->rawBody) === '') {
                return $this->parsedBody = [];
            }
            try {
                $decoded = json_decode($this->rawBody, true, 32, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new BadRequestException('The request body is not valid JSON.');
            }
            if (!is_array($decoded)) {
                throw new BadRequestException('The request body must be a JSON object.');
            }
            return $this->parsedBody = $decoded;
        }
        return $this->parsedBody = $this->formBody;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body()[$key] ?? $default;
    }

    public function all(): array
    {
        return array_merge($this->query, $this->body());
    }

    public function setAttribute(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function attribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }

    public function param(string $key, ?string $default = null): ?string
    {
        $params = $this->attributes['route_params'] ?? [];
        return $params[$key] ?? $default;
    }

    public function user(): ?array
    {
        $user = $this->attributes['user'] ?? null;
        return is_array($user) ? $user : null;
    }

    public function setUser(?array $user): void
    {
        $this->attributes['user'] = $user;
    }
}
