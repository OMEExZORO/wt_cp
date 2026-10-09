<?php

declare(strict_types=1);

namespace App\Services\Alerts;

use DateTimeImmutable;

final class ReadingQueue
{
    public const RANK = ['Urgent' => 0, 'Priority' => 1, 'Routine' => 2];

    public static function rank(string $urgency): int
    {
        return self::RANK[$urgency] ?? 3;
    }

    public static function waitingMinutes(?string $since, DateTimeImmutable $now): int
    {
        if ($since === null || $since === '') {
            return 0;
        }
        try {
            $start = new DateTimeImmutable($since);
        } catch (\Exception) {
            return 0;
        }
        return max(0, intdiv($now->getTimestamp() - $start->getTimestamp(), 60));
    }

    public static function sort(array $rows, DateTimeImmutable $now): array
    {
        $rows = array_map(static function (array $row) use ($now): array {
            $row['waiting_minutes'] = self::waitingMinutes($row['waiting_since'] ?? null, $now);
            return $row;
        }, $rows);
        usort($rows, static fn (array $a, array $b): int => [self::rank((string) $a['urgency']), -$a['waiting_minutes'], (string) ($a['reference_code'] ?? '')]
            <=> [self::rank((string) $b['urgency']), -$b['waiting_minutes'], (string) ($b['reference_code'] ?? '')]);
        return $rows;
    }

    public static function level(string $urgency, int $waitingMinutes): string
    {
        $limit = match ($urgency) {
            'Urgent' => 30,
            'Priority' => 120,
            default => 360,
        };
        if ($waitingMinutes >= $limit) {
            return 'overdue';
        }
        return $waitingMinutes >= intdiv($limit, 2) ? 'warning' : 'ok';
    }
}
