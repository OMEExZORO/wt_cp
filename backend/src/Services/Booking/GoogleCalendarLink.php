<?php

declare(strict_types=1);

namespace App\Services\Booking;

use DateTimeImmutable;
use DateTimeZone;

final class GoogleCalendarLink
{
    public const BASE = 'https://calendar.google.com/calendar/render';
    private const MAX_DETAILS = 1500;

    public static function build(string $title, DateTimeImmutable $start, DateTimeImmutable $end, string $details = '', string $location = ''): string
    {
        if ($end <= $start) {
            throw new \InvalidArgumentException('Event end must be after its start');
        }
        $utc = new DateTimeZone('UTC');
        $dates = $start->setTimezone($utc)->format('Ymd\THis\Z') . '/' . $end->setTimezone($utc)->format('Ymd\THis\Z');
        $params = [
            'action' => 'TEMPLATE',
            'text' => $title,
            'dates' => $dates,
            'details' => mb_substr($details, 0, self::MAX_DETAILS),
            'location' => $location,
            'ctz' => IcsCalendar::TZID,
        ];
        $pairs = [];
        foreach ($params as $key => $value) {
            if ($value === '' && $key !== 'text') {
                continue;
            }
            $encoded = $key === 'dates' ? str_replace('%2F', '/', rawurlencode($value)) : rawurlencode($value);
            $pairs[] = $key . '=' . $encoded;
        }
        return self::BASE . '?' . implode('&', $pairs);
    }
}
