<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

final class Csrf
{
    private const KEY = 'csrf_token';

    public static function token(): string
    {
        $token = Session::get(self::KEY);
        if (!is_string($token) || strlen($token) !== 64) {
            $token = bin2hex(random_bytes(32));
            Session::set(self::KEY, $token);
        }
        return $token;
    }

    public static function rotate(): string
    {
        Session::forget(self::KEY);
        return self::token();
    }

    public static function verify(Request $request): void
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        $sent = $request->header('x-csrf-token') ?? (string) $request->input('_csrf', '');
        $expected = Session::get(self::KEY);
        if (!is_string($expected) || !is_string($sent) || $sent === '' || !hash_equals($expected, $sent)) {
            throw new HttpException(419, 'Your session token is invalid or has expired. Please retry.', [], ['code' => 'csrf_mismatch']);
        }
    }
}
