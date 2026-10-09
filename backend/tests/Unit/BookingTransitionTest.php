<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\ConflictException;
use App\Services\Booking\BookingService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class BookingTransitionTest extends TestCase
{
    private function at(string $value): DateTimeImmutable
    {
        return new DateTimeImmutable($value, new DateTimeZone('Asia/Kolkata'));
    }

    private function slot(string $date = '2026-10-08', string $start = '10:00:00'): array
    {
        return ['slot_date' => $date, 'start_time' => $start, 'end_time' => '10:30:00'];
    }

    public static function allowed(): array
    {
        return [
            ['confirmed', 'checked_in'],
            ['pending', 'checked_in'],
            ['checked_in', 'in_progress'],
            ['checked_in', 'completed'],
            ['in_progress', 'completed'],
            ['confirmed', 'no_show'],
        ];
    }

    #[DataProvider('allowed')]
    public function testAllowedTransitions(string $from, string $to): void
    {
        BookingService::assertTransition($from, $to, $this->slot(), $this->at('2026-10-08 11:00'));
        $this->addToAssertionCount(1);
    }

    public static function refused(): array
    {
        return [
            ['cancelled', 'checked_in'],
            ['completed', 'checked_in'],
            ['no_show', 'completed'],
            ['confirmed', 'completed'],
            ['in_progress', 'no_show'],
        ];
    }

    #[DataProvider('refused')]
    public function testRefusedTransitions(string $from, string $to): void
    {
        $this->expectException(ConflictException::class);
        BookingService::assertTransition($from, $to, $this->slot(), $this->at('2026-10-08 11:00'));
    }

    public function testCheckInOnlyOnTheAppointmentDay(): void
    {
        $this->expectException(ConflictException::class);
        BookingService::assertTransition('confirmed', 'checked_in', $this->slot('2026-10-09'), $this->at('2026-10-08 11:00'));
    }

    public function testNoShowOnlyAfterStart(): void
    {
        $this->expectException(ConflictException::class);
        BookingService::assertTransition('confirmed', 'no_show', $this->slot('2026-10-08', '12:00:00'), $this->at('2026-10-08 11:00'));
    }
}
