<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Alerts\ReadingQueue;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

final class ReadingQueueTest extends TestCase
{
    private function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('2026-10-09 12:00:00', new DateTimeZone('Asia/Kolkata'));
    }

    private function row(string $ref, string $urgency, string $since): array
    {
        return ['reference_code' => $ref, 'urgency' => $urgency, 'waiting_since' => $since . '+05:30'];
    }

    public function testUrgentBeforePriorityBeforeRoutine(): void
    {
        $sorted = ReadingQueue::sort([
            $this->row('R1', 'Routine', '2026-10-09 06:00:00'),
            $this->row('P1', 'Priority', '2026-10-09 10:00:00'),
            $this->row('U1', 'Urgent', '2026-10-09 11:50:00'),
        ], $this->now());
        $this->assertSame(['U1', 'P1', 'R1'], array_column($sorted, 'reference_code'));
    }

    public function testLongerWaitFirstWithinSameUrgency(): void
    {
        $sorted = ReadingQueue::sort([
            $this->row('A', 'Priority', '2026-10-09 11:30:00'),
            $this->row('B', 'Priority', '2026-10-09 09:00:00'),
            $this->row('C', 'Priority', '2026-10-09 10:15:00'),
        ], $this->now());
        $this->assertSame(['B', 'C', 'A'], array_column($sorted, 'reference_code'));
        $this->assertSame([180, 105, 30], array_column($sorted, 'waiting_minutes'));
    }

    public function testWaitingMinutesNeverNegative(): void
    {
        $this->assertSame(0, ReadingQueue::waitingMinutes('2026-10-09 13:00:00+05:30', $this->now()));
        $this->assertSame(0, ReadingQueue::waitingMinutes(null, $this->now()));
        $this->assertSame(0, ReadingQueue::waitingMinutes('not a date', $this->now()));
    }

    public function testWaitLevels(): void
    {
        $this->assertSame('ok', ReadingQueue::level('Urgent', 5));
        $this->assertSame('warning', ReadingQueue::level('Urgent', 15));
        $this->assertSame('overdue', ReadingQueue::level('Urgent', 30));
        $this->assertSame('overdue', ReadingQueue::level('Routine', 400));
        $this->assertSame('ok', ReadingQueue::level('Routine', 100));
    }

    public function testEmptyQueue(): void
    {
        $this->assertSame([], ReadingQueue::sort([], $this->now()));
    }
}
