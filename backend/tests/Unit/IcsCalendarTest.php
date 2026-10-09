<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Booking\IcsCalendar;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

final class IcsCalendarTest extends TestCase
{
    private function event(array $overrides = []): array
    {
        $zone = new DateTimeZone('Asia/Kolkata');
        return array_merge([
            'uid' => '7d3c1d4e-1111-4222-8333-444455556666@diagnocare.test',
            'sequence' => 2,
            'dtstamp' => new DateTimeImmutable('2026-10-08 22:45:10', $zone),
            'start' => new DateTimeImmutable('2026-10-09 09:00', $zone),
            'end' => new DateTimeImmutable('2026-10-09 09:30', $zone),
            'summary' => 'CT Brain at MDC Bhosari',
            'description' => "Booking reference: MDC-261008-ABCDE\nPreparation: Remove metal items; bring reports, ID",
            'location' => 'MDC Bhosari, Nagdev Tower, Pune Nashik Road, Pune 411039',
        ], $overrides);
    }

    public function testProducesAValidCalendarSkeletonWithCrlf(): void
    {
        $ics = IcsCalendar::event($this->event());
        self::assertStringStartsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:", $ics);
        self::assertStringEndsWith("END:VEVENT\r\nEND:VCALENDAR\r\n", $ics);
        self::assertSame(0, preg_match("/(?<!\r)\n/", $ics));
        self::assertSame(1, substr_count($ics, 'BEGIN:VEVENT'));
        self::assertStringContainsString("METHOD:PUBLISH\r\n", $ics);
        self::assertStringContainsString("STATUS:CONFIRMED\r\n", $ics);
    }

    public function testUsesKolkataTimezoneUidStampAndSequence(): void
    {
        $ics = IcsCalendar::event($this->event());
        self::assertStringContainsString("BEGIN:VTIMEZONE\r\nTZID:Asia/Kolkata\r\n", $ics);
        self::assertStringContainsString("TZOFFSETTO:+0530\r\n", $ics);
        self::assertStringContainsString("DTSTART;TZID=Asia/Kolkata:20261009T090000\r\n", $ics);
        self::assertStringContainsString("DTEND;TZID=Asia/Kolkata:20261009T093000\r\n", $ics);
        self::assertStringContainsString("DTSTAMP:20261008T171510Z\r\n", $ics);
        self::assertStringContainsString("UID:7d3c1d4e-1111-4222-8333-444455556666@diagnocare.test\r\n", $ics);
        self::assertStringContainsString("SEQUENCE:2\r\n", $ics);
    }

    public function testConvertsUtcInputToLocalTime(): void
    {
        $utc = new DateTimeZone('UTC');
        $ics = IcsCalendar::event($this->event([
            'start' => new DateTimeImmutable('2026-10-09 03:30', $utc),
            'end' => new DateTimeImmutable('2026-10-09 04:00', $utc),
        ]));
        self::assertStringContainsString('DTSTART;TZID=Asia/Kolkata:20261009T090000', $ics);
    }

    public function testEscapesTextValues(): void
    {
        self::assertSame('a\\;b\\,c\\\\d\\ne', IcsCalendar::text("a;b,c\\d\ne"));
        $unfolded = str_replace("\r\n ", '', IcsCalendar::event($this->event()));
        self::assertStringContainsString('LOCATION:MDC Bhosari\\, Nagdev Tower\\, Pune Nashik Road\\, Pune 411039', $unfolded);
        self::assertStringContainsString('Remove metal items\\; bring reports\\, ID', $unfolded);
    }

    public function testFoldsLongLinesAt75OctetsWithoutSplittingCharacters(): void
    {
        $ics = IcsCalendar::event($this->event(['description' => str_repeat("\u{092E}\u{0947}\u{0918}\u{0928}\u{093E}\u{0926} diagnostic centre ", 20)]));
        foreach (explode("\r\n", rtrim($ics, "\r\n")) as $line) {
            self::assertLessThanOrEqual(75, strlen($line));
            self::assertTrue(mb_check_encoding($line, 'UTF-8'));
        }
        self::assertStringContainsString("\r\n ", $ics);
    }

    public function testCancelledEventUsesCancelMethod(): void
    {
        $ics = IcsCalendar::event($this->event(['status' => 'CANCELLED']));
        self::assertStringContainsString("METHOD:CANCEL\r\n", $ics);
        self::assertStringContainsString("STATUS:CANCELLED\r\n", $ics);
        self::assertStringNotContainsString('BEGIN:VALARM', $ics);
    }

    public function testRejectsEndBeforeStart(): void
    {
        $event = $this->event();
        $this->expectException(\InvalidArgumentException::class);
        IcsCalendar::event(array_merge($event, ['end' => $event['start']]));
    }

    public function testFilenameIsSafe(): void
    {
        self::assertSame('appointment-mdc-261008-abcde.ics', IcsCalendar::filename('MDC-261008-ABCDE'));
        self::assertSame('appointment-etcpasswd.ics', IcsCalendar::filename('../etc/passwd'));
    }
}
