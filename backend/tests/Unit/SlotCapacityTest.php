<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Booking\SlotCapacity;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SlotCapacityTest extends TestCase
{
    private function now(string $value = '2026-10-08 10:00'): DateTimeImmutable
    {
        return new DateTimeImmutable($value, new DateTimeZone('Asia/Kolkata'));
    }

    private function slot(array $overrides = []): array
    {
        return array_merge([
            'id' => 'slot-1',
            'branch_id' => 'branch-1',
            'modality' => 'CT',
            'slot_date' => '2026-10-09',
            'start_time' => '09:00:00',
            'end_time' => '09:30:00',
            'capacity' => 1,
            'booked_count' => 0,
            'is_blocked' => false,
            'branch_is_active' => true,
        ], $overrides);
    }

    public static function remainingCases(): array
    {
        return [
            'empty slot' => [2, 0, false, 2],
            'one left' => [2, 1, false, 1],
            'full' => [1, 1, false, 0],
            'overbooked data never goes negative' => [1, 3, false, 0],
            'blocked slot has no room' => [4, 0, true, 0],
            'zero capacity' => [0, 0, false, 0],
        ];
    }

    #[DataProvider('remainingCases')]
    public function testRemaining(int $capacity, int $booked, bool $blocked, int $expected): void
    {
        self::assertSame($expected, SlotCapacity::remaining($capacity, $booked, $blocked));
    }

    public function testOpenFutureSlotIsBookable(): void
    {
        self::assertSame(SlotCapacity::OK, SlotCapacity::status($this->slot(), $this->now(), 'CT'));
    }

    public function testFullSlotIsRejected(): void
    {
        self::assertSame(SlotCapacity::FULL, SlotCapacity::status($this->slot(['booked_count' => 1]), $this->now(), 'CT'));
    }

    public function testUsgSlotWithCapacityTwoAcceptsSecondBooking(): void
    {
        $slot = $this->slot(['modality' => 'USG', 'capacity' => 2, 'booked_count' => 1]);
        self::assertSame(SlotCapacity::OK, SlotCapacity::status($slot, $this->now(), 'USG'));
        self::assertSame(SlotCapacity::FULL, SlotCapacity::status(array_merge($slot, ['booked_count' => 2]), $this->now(), 'USG'));
    }

    public function testBlockedSlotIsRejected(): void
    {
        self::assertSame(SlotCapacity::BLOCKED, SlotCapacity::status($this->slot(['is_blocked' => 't']), $this->now()));
    }

    public function testSlotThatAlreadyStartedIsRejected(): void
    {
        self::assertSame(SlotCapacity::PAST, SlotCapacity::status($this->slot(['slot_date' => '2026-10-08', 'start_time' => '10:00:00']), $this->now()));
        self::assertSame(SlotCapacity::OK, SlotCapacity::status($this->slot(['slot_date' => '2026-10-08', 'start_time' => '10:30:00', 'end_time' => '11:00:00']), $this->now()));
    }

    public function testWrongModalityIsRejected(): void
    {
        self::assertSame(SlotCapacity::WRONG_MODALITY, SlotCapacity::status($this->slot(), $this->now(), 'USG'));
    }

    public function testInactiveBranchIsRejected(): void
    {
        self::assertSame(SlotCapacity::BRANCH_INACTIVE, SlotCapacity::status($this->slot(['branch_is_active' => false]), $this->now()));
    }

    public function testAfterBookingIncrementsAndRefusesOverflow(): void
    {
        self::assertSame(1, SlotCapacity::afterBooking(2, 0));
        self::assertSame(2, SlotCapacity::afterBooking(2, 1));
        $this->expectException(\OverflowException::class);
        SlotCapacity::afterBooking(2, 2);
    }

    public function testReleaseNeverGoesBelowZero(): void
    {
        self::assertSame(0, SlotCapacity::afterRelease(1));
        self::assertSame(0, SlotCapacity::afterRelease(0));
        self::assertSame(2, SlotCapacity::afterRelease(3));
    }

    public function testBranchIsFullWhenNoSlotIsBookable(): void
    {
        $slots = [
            $this->slot(['booked_count' => 1]),
            $this->slot(['is_blocked' => true]),
            $this->slot(['slot_date' => '2026-10-08', 'start_time' => '09:00:00']),
        ];
        self::assertTrue(SlotCapacity::isBranchFull($slots, $this->now()));
        $slots[] = $this->slot(['start_time' => '12:00:00', 'end_time' => '12:30:00']);
        self::assertFalse(SlotCapacity::isBranchFull($slots, $this->now()));
    }

    public function testStartAndEndUseIndianStandardTime(): void
    {
        self::assertSame('2026-10-09T09:00:00+05:30', SlotCapacity::startsAt($this->slot())->format(DATE_ATOM));
        self::assertSame('2026-10-09T09:30:00+05:30', SlotCapacity::endsAt($this->slot())->format(DATE_ATOM));
    }
}
