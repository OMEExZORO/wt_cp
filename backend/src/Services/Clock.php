<?php

declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;

final class Clock
{
    public function __construct(private readonly ?string $fixed = null)
    {
    }

    public function now(): DateTimeImmutable
    {
        $zone = new DateTimeZone(date_default_timezone_get());
        return $this->fixed !== null ? new DateTimeImmutable($this->fixed, $zone) : new DateTimeImmutable('now', $zone);
    }

    public function today(): string
    {
        return $this->now()->format('Y-m-d');
    }

    public function time(): string
    {
        return $this->now()->format('H:i:s');
    }
}
