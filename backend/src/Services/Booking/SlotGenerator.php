<?php

declare(strict_types=1);

namespace App\Services\Booking;

use App\Models\Slot;
use DateTimeImmutable;

final class SlotGenerator
{
    public const DEFAULT_CAPACITY = ['USG' => 2, 'CT' => 1, 'BIOPSY' => 1];

    public function __construct(private readonly Slot $slots)
    {
    }

    public static function plan(
        array $branchIds,
        array $capacities,
        string $fromDate,
        int $days,
        string $openTime = '09:00',
        string $closeTime = '17:00',
        int $intervalMinutes = 30,
        array $closedWeekdays = [7]
    ): array {
        if ($days < 1 || $days > 366) {
            throw new \InvalidArgumentException('Days must be between 1 and 366');
        }
        if ($intervalMinutes < 5 || $intervalMinutes > 240) {
            throw new \InvalidArgumentException('Interval must be between 5 and 240 minutes');
        }
        foreach ($capacities as $modality => $capacity) {
            if (!in_array($modality, ['USG', 'CT', 'BIOPSY'], true) || (int) $capacity < 1 || (int) $capacity > 50) {
                throw new \InvalidArgumentException(sprintf('Invalid capacity for %s', (string) $modality));
            }
        }
        $start = DateTimeImmutable::createFromFormat('!Y-m-d', $fromDate);
        $open = DateTimeImmutable::createFromFormat('!H:i', $openTime);
        $close = DateTimeImmutable::createFromFormat('!H:i', $closeTime);
        if ($start === false || $open === false || $close === false || $close <= $open) {
            throw new \InvalidArgumentException('Invalid date or opening hours');
        }

        $times = [];
        for ($t = $open; $t->modify('+' . $intervalMinutes . ' minutes') <= $close; $t = $t->modify('+' . $intervalMinutes . ' minutes')) {
            $times[] = [$t->format('H:i'), $t->modify('+' . $intervalMinutes . ' minutes')->format('H:i')];
        }

        $rows = [];
        for ($d = 0; $d < $days; $d++) {
            $date = $start->modify('+' . $d . ' days');
            if (in_array((int) $date->format('N'), $closedWeekdays, true)) {
                continue;
            }
            foreach ($branchIds as $branchId) {
                foreach ($capacities as $modality => $capacity) {
                    foreach ($times as [$from, $to]) {
                        $rows[] = [
                            'branch_id' => (string) $branchId,
                            'modality' => (string) $modality,
                            'slot_date' => $date->format('Y-m-d'),
                            'start_time' => $from,
                            'end_time' => $to,
                            'capacity' => (int) $capacity,
                        ];
                    }
                }
            }
        }
        return $rows;
    }

    public function insert(array $rows): int
    {
        return $this->slots->insertIgnore($rows);
    }
}
