<?php

declare(strict_types=1);

namespace App\Models;

final class Slot extends Model
{
    protected const TABLE = 'slots';
    protected const FILLABLE = ['branch_id', 'modality', 'slot_date', 'start_time', 'end_time', 'capacity', 'booked_count', 'is_blocked'];

    private const COLUMNS = 's.id, s.branch_id, s.modality, s.slot_date, s.start_time, s.end_time, s.capacity, s.booked_count, s.is_blocked,
                b.name AS branch_name, b.slug AS branch_slug, b.is_active AS branch_is_active';

    public function forDay(string $branchId, string $modality, string $date): array
    {
        return $this->fetchAll(
            'SELECT ' . self::COLUMNS . '
             FROM slots s JOIN branches b ON b.id = s.branch_id
             WHERE s.branch_id = :branch_id AND s.modality = :modality AND s.slot_date = :slot_date
             ORDER BY s.start_time',
            ['branch_id' => $branchId, 'modality' => $modality, 'slot_date' => $date]
        );
    }

    public function daySummary(string $branchId, string $modality, string $from, string $to, string $today, string $nowTime): array
    {
        return $this->fetchAll(
            'SELECT s.slot_date,
                    count(*) AS slot_count,
                    COALESCE(sum(CASE WHEN s.is_blocked OR (s.slot_date = CAST(:today AS date) AND s.start_time <= CAST(:now_time AS time))
                                      THEN 0 ELSE GREATEST(s.capacity - s.booked_count, 0) END), 0) AS remaining
             FROM slots s
             WHERE s.branch_id = :branch_id AND s.modality = :modality
               AND s.slot_date BETWEEN CAST(:from_date AS date) AND CAST(:to_date AS date)
               AND s.slot_date >= CAST(:today AS date)
             GROUP BY s.slot_date
             ORDER BY s.slot_date',
            ['branch_id' => $branchId, 'modality' => $modality, 'from_date' => $from, 'to_date' => $to, 'today' => $today, 'now_time' => $nowTime]
        );
    }

    public function nextAvailable(string $modality, string $fromDate, string $today, string $nowTime, ?string $excludeBranchId = null, ?string $onlyBranchId = null, ?string $fromTime = null): ?array
    {
        $sql = 'SELECT ' . self::COLUMNS . '
                FROM slots s JOIN branches b ON b.id = s.branch_id
                WHERE b.is_active = TRUE AND s.modality = :modality AND s.is_blocked = FALSE
                  AND s.booked_count < s.capacity
                  AND (s.slot_date, s.start_time) > (CAST(:today AS date), CAST(:now_time AS time))
                  AND (s.slot_date, s.start_time) >= (CAST(:from_date AS date), CAST(:from_time AS time))';
        $params = ['modality' => $modality, 'from_date' => $fromDate, 'from_time' => $fromTime ?? '00:00', 'today' => $today, 'now_time' => $nowTime];
        if ($excludeBranchId !== null) {
            $sql .= ' AND s.branch_id <> :exclude_branch_id';
            $params['exclude_branch_id'] = $excludeBranchId;
        }
        if ($onlyBranchId !== null) {
            $sql .= ' AND s.branch_id = :only_branch_id';
            $params['only_branch_id'] = $onlyBranchId;
        }
        $sql .= ' ORDER BY s.slot_date, s.start_time, b.sort_order, b.name LIMIT 1';
        return $this->fetchOne($sql, $params);
    }

    public function findWithBranch(string $id): ?array
    {
        return $this->fetchOne(
            'SELECT ' . self::COLUMNS . ' FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id = :id',
            ['id' => $id]
        );
    }

    public function lockForUpdate(string $id): ?array
    {
        return $this->fetchOne(
            'SELECT ' . self::COLUMNS . ' FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id = :id FOR UPDATE OF s',
            ['id' => $id]
        );
    }

    public function lockPair(string $first, string $second): array
    {
        $rows = $this->fetchAll(
            'SELECT ' . self::COLUMNS . ' FROM slots s JOIN branches b ON b.id = s.branch_id
             WHERE s.id IN (:first, :second) ORDER BY s.id FOR UPDATE OF s',
            ['first' => $first, 'second' => $second]
        );
        $byId = [];
        foreach ($rows as $row) {
            $byId[(string) $row['id']] = $row;
        }
        return $byId;
    }

    public function incrementBooked(string $id): void
    {
        $this->execute('UPDATE slots SET booked_count = booked_count + 1 WHERE id = :id', ['id' => $id]);
    }

    public function releaseBooked(string $id): void
    {
        $this->execute('UPDATE slots SET booked_count = GREATEST(booked_count - 1, 0) WHERE id = :id', ['id' => $id]);
    }

    public function insertIgnore(array $rows): int
    {
        $inserted = 0;
        foreach (array_chunk($rows, 1000) as $chunk) {
            $payload = json_encode(array_map(static fn (array $row): array => [
                'branch_id' => (string) $row['branch_id'],
                'modality' => (string) $row['modality'],
                'slot_date' => (string) $row['slot_date'],
                'start_time' => (string) $row['start_time'],
                'end_time' => (string) $row['end_time'],
                'capacity' => (int) $row['capacity'],
            ], $chunk), JSON_THROW_ON_ERROR);
            $inserted += $this->execute(
                'INSERT INTO slots (branch_id, modality, slot_date, start_time, end_time, capacity)
                 SELECT r.branch_id, r.modality, r.slot_date, r.start_time, r.end_time, r.capacity
                 FROM jsonb_to_recordset(CAST(:rows AS jsonb))
                      AS r (branch_id uuid, modality text, slot_date date, start_time time, end_time time, capacity integer)
                 ON CONFLICT ON CONSTRAINT slots_branch_modality_date_time_unique DO NOTHING',
                ['rows' => $payload]
            );
        }
        return $inserted;
    }
}
