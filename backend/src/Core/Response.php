<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    private array $headers = [];

    public function __construct(
        private string $body = '',
        private int $status = 200,
        array $headers = []
    ) {
        foreach ($headers as $name => $value) {
            $this->setHeader($name, $value);
        }
    }

    public static function json(mixed $data, int $status = 200, array $meta = []): self
    {
        $body = ['data' => $data, 'error' => null];
        if ($meta !== []) {
            $body['meta'] = $meta;
        }
        return self::encode($body, $status);
    }

    public static function error(string $code, string $message, int $status = 400, array $fields = [], array $extra = []): self
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) {
            $error['fields'] = $fields;
        }
        foreach ($extra as $key => $value) {
            $error[$key] = $value;
        }
        return self::encode(['data' => null, 'error' => $error], $status);
    }

    public static function noContent(): self
    {
        return new self('', 204);
    }

    private static function encode(array $body, int $status): self
    {
        $json = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        return new self($json, $status, ['Content-Type' => 'application/json; charset=utf-8']);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function withStatus(int $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function body(): string
    {
        return $this->body;
    }

    public function decoded(): ?array
    {
        $decoded = json_decode($this->body, true);
        return is_array($decoded) ? $decoded : null;
    }

    public function setHeader(string $name, string $value): self
    {
        $this->headers[strtolower($name)] = [$name, $value];
        return $this;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)][1] ?? null;
    }

    public function headers(): array
    {
        $result = [];
        foreach ($this->headers as [$name, $value]) {
            $result[$name] = $value;
        }
        return $result;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            foreach ($this->headers as [$name, $value]) {
                header($name . ': ' . $value);
            }
        }
        if ($this->status !== 204) {
            echo $this->body;
        }
    }
}
