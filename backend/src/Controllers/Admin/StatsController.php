<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Models\StatsRepository;
use App\Services\AuditLogger;
use App\Services\Clock;

final class StatsController extends AdminController
{
    public function __construct(AuditLogger $audit, private readonly StatsRepository $stats, private readonly Clock $clock)
    {
        parent::__construct($audit);
    }

    public function show(Request $request): Response
    {
        $filters = $this->validate($request, ['days' => 'nullable|integer|min:7|max:90']);
        $days = (int) ($filters['days'] ?? 30);
        $to = $this->clock->now();
        $from = $to->modify('-' . ($days - 1) . ' days');
        $fromDate = $from->format('Y-m-d');
        $toDate = $to->format('Y-m-d');

        $perDay = $this->stats->perDayPerBranch($fromDate, $toDate);
        $totals = [];
        for ($i = 0; $i < $days; $i++) {
            $totals[$from->modify('+' . $i . ' days')->format('Y-m-d')] = 0;
        }
        foreach ($perDay as $row) {
            $totals[(string) $row['day']] = ($totals[(string) $row['day']] ?? 0) + (int) $row['total'];
        }
        $byStatus = array_map(static fn (array $row): array => ['status' => $row['status'], 'total' => (int) $row['total']], $this->stats->byStatus($fromDate, $toDate));
        $byModality = array_map(static fn (array $row): array => ['modality' => $row['modality'], 'total' => (int) $row['total']], $this->stats->byModality($fromDate, $toDate));

        return $this->ok([
            'window' => ['from' => $fromDate, 'to' => $toDate, 'days' => $days],
            'per_day_per_branch' => array_map(static fn (array $row): array => [
                'date' => (string) $row['day'],
                'branch_id' => $row['branch_id'],
                'branch_name' => $row['branch_name'],
                'total' => (int) $row['total'],
            ], $perDay),
            'daily_totals' => array_map(static fn (string $date, int $total): array => ['date' => $date, 'total' => $total], array_keys($totals), array_values($totals)),
            'by_status' => $byStatus,
            'by_modality' => $byModality,
            'appointments_in_window' => array_sum($totals),
            'pending_reviews' => $this->stats->pendingReviews(),
        ]);
    }
}
