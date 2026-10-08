<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function json(mixed $data, int $status = 200, array $meta = []): never
    {
        $body = ['data' => $data, 'error' => null];
        if ($meta !== []) {
            $body['meta'] = $meta;
        }
        self::send($body, $status);
    }

    public static function error(string $code, string $message, int $status = 400, array $fields = []): never
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) {
            $error['fields'] = $fields;
        }
        self::send(['data' => null, 'error' => $error], $status);
    }

    private static function send(array $body, int $status): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }
}
