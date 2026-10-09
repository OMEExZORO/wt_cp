<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Model;
use App\Models\ReadingQueueQuery;
use App\Services\Alerts\ReadingQueue;
use App\Services\Clock;

final class QueueController extends Controller
{
    public function __construct(
        private readonly ReadingQueueQuery $query,
        private readonly Clock $clock
    ) {
    }

    public function show(Request $request): Response
    {
        $now = $this->clock->now();
        $rows = ReadingQueue::sort($this->query->awaitingReport(500), $now);
        $queue = array_map(static fn (array $row): array => [
            'appointment_id' => $row['id'],
            'reference_code' => $row['reference_code'],
            'patient_name' => $row['patient_name'],
            'scan_name' => $row['scan_name'],
            'modality' => $row['modality'],
            'branch_name' => $row['branch_name'],
            'urgency' => $row['urgency'],
            'is_referred' => $row['referral_id'] !== null,
            'waiting_since' => Model::iso($row['waiting_since']),
            'waiting_minutes' => $row['waiting_minutes'],
            'wait_level' => ReadingQueue::level((string) $row['urgency'], $row['waiting_minutes']),
        ], $rows);

        $reports = array_map(static fn (array $row): array => [
            'report_id' => $row['id'],
            'title' => $row['title'],
            'status' => $row['status'],
            'is_critical' => Model::flag($row['is_critical']),
            'reference_code' => $row['reference_code'],
            'patient_name' => $row['patient_name'],
            'scan_name' => $row['scan_name'],
            'alert_id' => $row['alert_id'],
            'alert_status' => $row['alert_status'],
            'created_at' => Model::iso($row['created_at']),
        ], $this->query->recentReports(30, 50));

        return $this->ok(['queue' => $queue, 'recent_reports' => $reports, 'generated_at' => $now->format(\DateTimeInterface::ATOM)]);
    }
}
