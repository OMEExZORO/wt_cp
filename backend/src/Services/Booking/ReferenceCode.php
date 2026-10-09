<?php

declare(strict_types=1);

namespace App\Services\Booking;

use DateTimeImmutable;

final class ReferenceCode
{
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    public const PATTERN = '/^MDC-\d{6}-[A-HJ-NP-Z2-9]{5}$/';

    public static function generate(?DateTimeImmutable $date = null): string
    {
        $suffix = '';
        $max = strlen(self::ALPHABET) - 1;
        for ($i = 0; $i < 5; $i++) {
            $suffix .= self::ALPHABET[random_int(0, $max)];
        }
        return 'MDC-' . ($date ?? new DateTimeImmutable('now'))->format('ymd') . '-' . $suffix;
    }
}
