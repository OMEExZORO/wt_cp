<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

final class Response
{
    public static function securityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        header('Cache-Control: no-store, max-age=0');
        header('Pragma: no-cache');
    }

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            self::escape($data),
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
        exit;
    }

    public static function ok(mixed $data = null, string $message = 'OK', int $status = 200): never
    {
        self::json(['success' => true, 'message' => $message, 'data' => $data], $status);
    }

    public static function error(int $status, string $message, array $errors = [], array $extra = []): never
    {
        $payload = ['success' => false, 'message' => $message];
        if ($errors !== []) {
            $payload['errors'] = $errors;
        }
        self::json($payload + $extra, $status);
    }

    public static function escape(mixed $value): mixed
    {
        if (is_string($value)) {
            return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
        }
        if (is_array($value)) {
            $out = [];
            foreach ($value as $key => $item) {
                $out[$key] = self::escape($item);
            }
            return $out;
        }
        return $value;
    }

    public static function file(string $contents, string $mime, string $downloadName): never
    {
        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $downloadName) ?: 'report';
        http_response_code(200);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . strlen($contents));
        header('Content-Disposition: attachment; filename="' . $safeName . '"');
        echo $contents;
        exit;
    }
}
