<?php

declare(strict_types=1);

namespace App\Services\Booking;

use DateTimeImmutable;
use DateTimeZone;

final class IcsCalendar
{
    public const TZID = 'Asia/Kolkata';
    private const PRODID = '-//Meghnad Diagnostic Centre//DiagnoCare Booking//EN';
    private const LINE_LIMIT = 75;

    public static function event(array $event): string
    {
        foreach (['uid', 'start', 'end', 'summary'] as $key) {
            if (!isset($event[$key])) {
                throw new \InvalidArgumentException(sprintf('Missing calendar field %s', $key));
            }
        }
        $start = self::local($event['start']);
        $end = self::local($event['end']);
        if ($end <= $start) {
            throw new \InvalidArgumentException('Event end must be after its start');
        }
        $stamp = ($event['dtstamp'] ?? new DateTimeImmutable('now'))->setTimezone(new DateTimeZone('UTC'));
        $cancelled = ($event['status'] ?? 'CONFIRMED') === 'CANCELLED';

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:' . self::PRODID,
            'CALSCALE:GREGORIAN',
            'METHOD:' . ($cancelled ? 'CANCEL' : 'PUBLISH'),
            'BEGIN:VTIMEZONE',
            'TZID:' . self::TZID,
            'BEGIN:STANDARD',
            'DTSTART:19700101T000000',
            'TZOFFSETFROM:+0530',
            'TZOFFSETTO:+0530',
            'TZNAME:IST',
            'END:STANDARD',
            'END:VTIMEZONE',
            'BEGIN:VEVENT',
            'UID:' . self::text((string) $event['uid']),
            'SEQUENCE:' . max(0, (int) ($event['sequence'] ?? 0)),
            'DTSTAMP:' . $stamp->format('Ymd\THis\Z'),
            'DTSTART;TZID=' . self::TZID . ':' . $start->format('Ymd\THis'),
            'DTEND;TZID=' . self::TZID . ':' . $end->format('Ymd\THis'),
            'SUMMARY:' . self::text((string) $event['summary']),
        ];
        if (($event['description'] ?? '') !== '') {
            $lines[] = 'DESCRIPTION:' . self::text((string) $event['description']);
        }
        if (($event['location'] ?? '') !== '') {
            $lines[] = 'LOCATION:' . self::text((string) $event['location']);
        }
        if (($event['url'] ?? '') !== '') {
            $lines[] = 'URL:' . self::uri((string) $event['url']);
        }
        $lines[] = 'STATUS:' . ($cancelled ? 'CANCELLED' : 'CONFIRMED');
        $lines[] = 'TRANSP:OPAQUE';
        if (!$cancelled) {
            $lines[] = 'BEGIN:VALARM';
            $lines[] = 'ACTION:DISPLAY';
            $lines[] = 'DESCRIPTION:' . self::text('Reminder: ' . (string) $event['summary']);
            $lines[] = 'TRIGGER:-PT2H';
            $lines[] = 'END:VALARM';
        }
        $lines[] = 'END:VEVENT';
        $lines[] = 'END:VCALENDAR';

        return implode("\r\n", array_map(self::fold(...), $lines)) . "\r\n";
    }

    public static function text(string $value): string
    {
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        $value = preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', '', $value) ?? '';
        return str_replace(['\\', ';', ',', "\n"], ['\\\\', '\\;', '\\,', '\\n'], $value);
    }

    public static function fold(string $line): string
    {
        if (strlen($line) <= self::LINE_LIMIT) {
            return $line;
        }
        $parts = [];
        $current = '';
        $limit = self::LINE_LIMIT;
        foreach (mb_str_split($line) as $char) {
            if (strlen($current) + strlen($char) > $limit) {
                $parts[] = $current;
                $current = '';
                $limit = self::LINE_LIMIT - 1;
            }
            $current .= $char;
        }
        $parts[] = $current;
        return implode("\r\n ", $parts);
    }

    public static function filename(string $reference): string
    {
        $safe = preg_replace('/[^A-Za-z0-9\-]/', '', $reference) ?? '';
        return 'appointment-' . ($safe === '' ? 'mdc' : strtolower($safe)) . '.ics';
    }

    private static function uri(string $value): string
    {
        return preg_replace('/[\x00-\x20\x7F]/', '', $value) ?? '';
    }

    private static function local(DateTimeImmutable $value): DateTimeImmutable
    {
        return $value->setTimezone(new DateTimeZone(self::TZID));
    }
}
