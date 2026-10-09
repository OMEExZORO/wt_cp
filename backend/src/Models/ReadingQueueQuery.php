<?php

declare(strict_types=1);

namespace App\Models;

final class ReadingQueueQuery extends Model
{
    public function awaitingReport(int $limit): array
    {
        return $this->fetchAll(
            "SELECT a.id, a.reference_code, a.urgency, a.status, a.referral_id, s.modality, b.name AS branch_name,
                    t.name AS scan_name, p.full_name AS patient_name,
                    COALESCE(a.completed_at, (s.slot_date + s.end_time) AT TIME ZONE 'Asia/Kolkata') AS waiting_since
             FROM appointments a
             JOIN slots s ON s.id = a.slot_id
             JOIN branches b ON b.id = a.branch_id
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN patients p ON p.id = a.patient_id
             WHERE a.status = 'completed'
               AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.appointment_id = a.id AND r.deleted_at IS NULL AND r.status <> 'draft')
             LIMIT :limit_rows",
            ['limit_rows' => $limit]
        );
    }

    public function recentReports(int $days, int $limit): array
    {
        return $this->fetchAll(
            "SELECT r.id, r.title, r.status, r.is_critical, r.created_at, a.reference_code, t.name AS scan_name, p.full_name AS patient_name,
                    (SELECT ca.status FROM critical_alerts ca WHERE ca.report_id = r.id ORDER BY ca.created_at DESC LIMIT 1) AS alert_status,
                    (SELECT ca.id FROM critical_alerts ca WHERE ca.report_id = r.id ORDER BY ca.created_at DESC LIMIT 1) AS alert_id
             FROM reports r
             JOIN appointments a ON a.id = r.appointment_id
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN patients p ON p.id = r.patient_id
             WHERE r.deleted_at IS NULL AND r.created_at >= now() - make_interval(days => :days)
             ORDER BY r.created_at DESC
             LIMIT :limit_rows",
            ['days' => $days, 'limit_rows' => $limit]
        );
    }
}
