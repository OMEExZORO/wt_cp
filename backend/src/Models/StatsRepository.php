<?php

declare(strict_types=1);

namespace App\Models;

final class StatsRepository extends Model
{
    public function perDayPerBranch(string $from, string $to): array
    {
        return $this->fetchAll(
            "SELECT s.slot_date AS day, b.id AS branch_id, b.name AS branch_name, count(*) AS total
             FROM appointments a JOIN slots s ON s.id = a.slot_id JOIN branches b ON b.id = a.branch_id
             WHERE a.status <> 'cancelled' AND s.slot_date BETWEEN CAST(:from_date AS date) AND CAST(:to_date AS date)
             GROUP BY s.slot_date, b.id, b.name ORDER BY s.slot_date, b.name",
            ['from_date' => $from, 'to_date' => $to]
        );
    }

    public function byStatus(string $from, string $to): array
    {
        return $this->fetchAll(
            'SELECT a.status, count(*) AS total
             FROM appointments a JOIN slots s ON s.id = a.slot_id
             WHERE s.slot_date BETWEEN CAST(:from_date AS date) AND CAST(:to_date AS date)
             GROUP BY a.status ORDER BY total DESC, a.status',
            ['from_date' => $from, 'to_date' => $to]
        );
    }

    public function byModality(string $from, string $to): array
    {
        return $this->fetchAll(
            "SELECT s.modality, count(*) AS total
             FROM appointments a JOIN slots s ON s.id = a.slot_id
             WHERE a.status <> 'cancelled' AND s.slot_date BETWEEN CAST(:from_date AS date) AND CAST(:to_date AS date)
             GROUP BY s.modality ORDER BY total DESC, s.modality",
            ['from_date' => $from, 'to_date' => $to]
        );
    }

    public function pendingReviews(): int
    {
        return (int) $this->fetchValue("SELECT count(*) FROM reviews WHERE status = 'pending'");
    }
}
