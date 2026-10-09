<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Booking\SlotGenerator;
use PHPUnit\Framework\TestCase;

final class SlotGeneratorTest extends TestCase
{
    public function testPlansSlotsForEveryOpenDayBranchAndModality(): void
    {
        $rows = SlotGenerator::plan(['b1', 'b2'], ['USG' => 2, 'CT' => 1], '2026-10-10', 2, '09:00', '10:00', 30);
        self::assertCount(1 * 2 * 2 * 2, $rows);
        self::assertSame(
            ['branch_id' => 'b1', 'modality' => 'USG', 'slot_date' => '2026-10-10', 'start_time' => '09:00', 'end_time' => '09:30', 'capacity' => 2],
            $rows[0]
        );
        self::assertSame('09:30', $rows[1]['start_time']);
        self::assertSame('10:00', $rows[1]['end_time']);
    }

    public function testSkipsClosedWeekdays(): void
    {
        self::assertSame([], SlotGenerator::plan(['b1'], ['CT' => 1], '2026-10-11', 1, '09:00', '10:00', 30, [7]));
        self::assertCount(2, SlotGenerator::plan(['b1'], ['CT' => 1], '2026-10-11', 1, '09:00', '10:00', 30, []));
    }

    public function testLastSlotEndsAtOrBeforeClosing(): void
    {
        $rows = SlotGenerator::plan(['b1'], ['CT' => 1], '2026-10-10', 1, '09:00', '10:15', 30);
        self::assertSame('10:00', end($rows)['end_time']);
    }

    public function testRejectsUnknownModality(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        SlotGenerator::plan(['b1'], ['MRI' => 1], '2026-10-10', 1);
    }
}
