<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Booking\GoogleCalendarLink;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

final class GoogleCalendarLinkTest extends TestCase
{
    private function link(string $details = 'Bring reports', string $location = 'MDC Bhosari, Pune'): string
    {
        $zone = new DateTimeZone('Asia/Kolkata');
        return GoogleCalendarLink::build(
            'CT Brain & contrast at MDC',
            new DateTimeImmutable('2026-10-09 09:00', $zone),
            new DateTimeImmutable('2026-10-09 09:30', $zone),
            $details,
            $location
        );
    }

    public function testBuildsTemplateUrl(): void
    {
        $url = $this->link();
        self::assertStringStartsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&', $url);
        self::assertStringContainsString('&ctz=Asia%2FKolkata', $url);
    }

    public function testDatesAreUtcWithLiteralSlash(): void
    {
        self::assertStringContainsString('&dates=20261009T033000Z/20261009T040000Z', $this->link());
    }

    public function testEncodesTextDetailsAndLocation(): void
    {
        $url = $this->link("Line 1\nLine 2", 'Nagdev Tower, Bhosari');
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        self::assertSame('CT Brain & contrast at MDC', $query['text']);
        self::assertSame("Line 1\nLine 2", $query['details']);
        self::assertSame('Nagdev Tower, Bhosari', $query['location']);
        self::assertStringContainsString('text=CT%20Brain%20%26%20contrast%20at%20MDC', $url);
        self::assertStringNotContainsString(' ', $url);
    }

    public function testOmitsEmptyOptionalParameters(): void
    {
        $url = $this->link('', '');
        self::assertStringNotContainsString('details=', $url);
        self::assertStringNotContainsString('location=', $url);
    }

    public function testRejectsInvertedRange(): void
    {
        $zone = new DateTimeZone('Asia/Kolkata');
        $this->expectException(\InvalidArgumentException::class);
        GoogleCalendarLink::build('x', new DateTimeImmutable('2026-10-09 10:00', $zone), new DateTimeImmutable('2026-10-09 09:00', $zone));
    }
}
