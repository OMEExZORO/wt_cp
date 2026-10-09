<?php

declare(strict_types=1);

namespace App\Services\Booking;

use App\Models\Model;
use DateTimeImmutable;
use DateTimeZone;

final class SlotCapacity
{
    public const OK = 'ok';
    public const FULL = 'full';
    public const BLOCKED = 'blocked';
    public const PAST = 'past';
    public const BRANCH_INACTIVE = 'branch_inactive';
    public const WRONG_MODALITY = 'wrong_modality';

    public const TIMEZONE = 'Asia/Kolkata';

    public static function remaining(int $capacity, int $booked, bool $blocked = false): int
    {
        if ($blocked || $capacity <= 0) {
            return 0;
        }
        return max(0, $capacity - max(0, $booked));
    }

    public static function remainingFor(array $slot): int
    {
        return self::remaining((int) $slot['capacity'], (int) $slot['booked_count'], Model::flag($slot['is_blocked'] ?? false));
    }

    public static function startsAt(array $slot): DateTimeImmutable
    {
        return self::at((string) $slot['slot_date'], (string) $slot['start_time']);
    }

    public static function endsAt(array $slot): DateTimeImmutable
    {
        return self::at((string) $slot['slot_date'], (string) $slot['end_time']);
    }

    public static function at(string $date, string $time): DateTimeImmutable
    {
        $result = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $date . ' ' . substr($time, 0, 5), new DateTimeZone(self::TIMEZONE));
        if ($result === false) {
            throw new \InvalidArgumentException('Invalid slot date or time');
        }
        return $result;
    }

    public static function hasStarted(array $slot, DateTimeImmutable $now): bool
    {
        return self::startsAt($slot) <= $now;
    }

    public static function status(array $slot, DateTimeImmutable $now, ?string $modality = null): string
    {
        if ($modality !== null && (string) $slot['modality'] !== $modality) {
            return self::WRONG_MODALITY;
        }
        if (array_key_exists('branch_is_active', $slot) && !Model::flag($slot['branch_is_active'])) {
            return self::BRANCH_INACTIVE;
        }
        if (Model::flag($slot['is_blocked'] ?? false)) {
            return self::BLOCKED;
        }
        if (self::hasStarted($slot, $now)) {
            return self::PAST;
        }
        if (self::remainingFor($slot) <= 0) {
            return self::FULL;
        }
        return self::OK;
    }

    public static function message(string $status): string
    {
        return match ($status) {
            self::FULL => 'This time slot has just been fully booked. Please choose another time.',
            self::BLOCKED => 'This time slot is not available for booking.',
            self::PAST => 'This time slot has already started. Please choose a later time.',
            self::BRANCH_INACTIVE => 'This branch is not taking bookings at the moment.',
            self::WRONG_MODALITY => 'This time slot is not for the selected scan.',
            default => 'This time slot is available.',
        };
    }

    public static function afterBooking(int $capacity, int $booked): int
    {
        if ($booked >= $capacity) {
            throw new \OverflowException('Slot capacity exceeded');
        }
        return $booked + 1;
    }

    public static function afterRelease(int $booked): int
    {
        return max(0, $booked - 1);
    }

    public static function isBranchFull(array $slots, DateTimeImmutable $now): bool
    {
        foreach ($slots as $slot) {
            if (self::status($slot, $now) === self::OK) {
                return false;
            }
        }
        return true;
    }
}
