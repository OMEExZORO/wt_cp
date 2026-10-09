<?php

declare(strict_types=1);

namespace App\Services\Booking;

use App\Models\Model;
use DateTimeImmutable;

final class SlotPresenter
{
    public static function present(array $slot, ?DateTimeImmutable $now = null): array
    {
        $remaining = SlotCapacity::remainingFor($slot);
        $status = $now !== null ? SlotCapacity::status($slot, $now) : ($remaining > 0 ? SlotCapacity::OK : SlotCapacity::FULL);
        return [
            'id' => $slot['id'],
            'branch_id' => $slot['branch_id'],
            'modality' => $slot['modality'],
            'date' => (string) $slot['slot_date'],
            'start_time' => substr((string) $slot['start_time'], 0, 5),
            'end_time' => substr((string) $slot['end_time'], 0, 5),
            'starts_at' => SlotCapacity::startsAt($slot)->format(\DateTimeInterface::ATOM),
            'capacity' => (int) $slot['capacity'],
            'booked_count' => (int) $slot['booked_count'],
            'remaining' => $remaining,
            'is_blocked' => Model::flag($slot['is_blocked'] ?? false),
            'is_available' => $status === SlotCapacity::OK,
            'status' => $status,
        ];
    }
}
