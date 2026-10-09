<?php

declare(strict_types=1);

namespace App\Models;

final class CriticalAlert extends Model
{
    protected const TABLE = 'critical_alerts';
    protected const FILLABLE = [
        'report_id', 'patient_id', 'referrer_id', 'raised_by_user_id', 'finding_summary_encrypted', 'status',
        'escalation_level', 'notify_count', 'last_notified_at', 'next_escalation_at', 'staff_flagged_at',
        'acknowledged_at', 'acknowledged_by_user_id', 'resolved_at', 'resolved_by_user_id', 'resolution_note',
    ];

    private const DETAIL = 'SELECT ca.id, ca.report_id, ca.patient_id, ca.referrer_id, ca.status, ca.escalation_level, ca.notify_count,
                ca.last_notified_at, ca.next_escalation_at, ca.staff_flagged_at, ca.acknowledged_at, ca.acknowledged_by_user_id,
                ca.resolved_at, ca.resolved_by_user_id, ca.resolution_note, ca.created_at, ca.updated_at,
                ap.id AS appointment_id, ap.reference_code, t.name AS scan_name, rep.title AS report_title,
                p.full_name AS patient_name, p.phone AS patient_phone, COALESCE(pu.email, p.email) AS patient_email, p.user_id AS patient_user_id,
                ref.full_name AS referrer_name, ref.user_id AS referrer_user_id, ru.email AS referrer_email,
                (SELECT u.full_name FROM users u WHERE u.id = ca.raised_by_user_id) AS raised_by_name,
                (SELECT u.full_name FROM users u WHERE u.id = ca.acknowledged_by_user_id) AS acknowledged_by_name,
                (SELECT u.full_name FROM users u WHERE u.id = ca.resolved_by_user_id) AS resolved_by_name
            FROM critical_alerts ca
            JOIN reports rep ON rep.id = ca.report_id
            JOIN appointments ap ON ap.id = rep.appointment_id
            JOIN scan_types t ON t.id = ap.scan_type_id
            JOIN patients p ON p.id = ca.patient_id
            LEFT JOIN users pu ON pu.id = p.user_id
            LEFT JOIN referrers ref ON ref.id = ca.referrer_id
            LEFT JOIN users ru ON ru.id = ref.user_id';

    public function reportContext(string $reportId): ?array
    {
        return $this->fetchOne(
            'SELECT r.id AS report_id, r.title AS report_title, r.is_critical, r.deleted_at, r.patient_id, r.appointment_id,
                    a.reference_code, t.name AS scan_name, p.full_name AS patient_name, p.phone AS patient_phone,
                    COALESCE(pu.email, p.email) AS patient_email, p.user_id AS patient_user_id,
                    ref.id AS referrer_id, ref.full_name AS referrer_name, ref.user_id AS referrer_user_id, ru.email AS referrer_email
             FROM reports r
             JOIN appointments a ON a.id = r.appointment_id
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN patients p ON p.id = r.patient_id
             LEFT JOIN users pu ON pu.id = p.user_id
             LEFT JOIN referrals rf ON rf.id = a.referral_id
             LEFT JOIN referrers ref ON ref.id = rf.referrer_id
             LEFT JOIN users ru ON ru.id = ref.user_id
             WHERE r.id = :id',
            ['id' => $reportId]
        );
    }

    public function lockReport(string $reportId): ?array
    {
        return $this->fetchOne('SELECT id, is_critical, deleted_at FROM reports WHERE id = :id FOR UPDATE', ['id' => $reportId]);
    }

    public function hasActiveForReport(string $reportId): bool
    {
        return Model::flag($this->fetchValue(
            "SELECT EXISTS (SELECT 1 FROM critical_alerts WHERE report_id = :id AND status NOT IN ('resolved', 'cancelled'))",
            ['id' => $reportId]
        ));
    }

    public function markReportCritical(string $reportId): void
    {
        $this->execute('UPDATE reports SET is_critical = TRUE WHERE id = :id', ['id' => $reportId]);
    }

    public function findDetailed(string $id): ?array
    {
        return $this->fetchOne(self::DETAIL . ' WHERE ca.id = :id', ['id' => $id]);
    }

    public function lockForUpdate(string $id): ?array
    {
        return $this->fetchOne('SELECT id, status FROM critical_alerts WHERE id = :id FOR UPDATE', ['id' => $id]);
    }

    public function listUnacknowledgedForUser(string $userId, string $role): array
    {
        $column = $role === 'referrer' ? 'ref.user_id' : 'p.user_id';
        return $this->fetchAll(
            self::DETAIL . " WHERE {$column} = :user_id AND ca.status IN ('open', 'notified', 'escalated') ORDER BY ca.created_at DESC LIMIT 50",
            ['user_id' => $userId]
        );
    }

    public function listForStaff(array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->staffWhere($filters);
        $params['limit_rows'] = $limit;
        $params['offset_rows'] = $offset;
        return $this->fetchAll(
            self::DETAIL . ' WHERE TRUE' . $where
            . " ORDER BY (CASE WHEN ca.staff_flagged_at IS NOT NULL AND ca.status IN ('open', 'notified', 'escalated') THEN 0 ELSE 1 END),
                (CASE WHEN ca.status IN ('open', 'notified', 'escalated') THEN 0 ELSE 1 END), ca.created_at DESC
               LIMIT :limit_rows OFFSET :offset_rows",
            $params
        );
    }

    public function countForStaff(array $filters): int
    {
        [$where, $params] = $this->staffWhere($filters);
        return (int) $this->fetchValue(
            'SELECT count(*) FROM critical_alerts ca JOIN patients p ON p.id = ca.patient_id WHERE TRUE' . $where,
            $params
        );
    }

    public function applyNotified(string $id, int $notifyCount, int $windowMinutes): void
    {
        $this->execute(
            "UPDATE critical_alerts SET status = 'notified', notify_count = :notify_count, last_notified_at = now(),
                    next_escalation_at = now() + make_interval(mins => :window)
             WHERE id = :id AND status = 'open'",
            ['id' => $id, 'notify_count' => $notifyCount, 'window' => $windowMinutes]
        );
    }

    public function applyAcknowledged(string $id, string $userId): void
    {
        $this->execute(
            "UPDATE critical_alerts SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by_user_id = :user_id,
                    next_escalation_at = NULL
             WHERE id = :id",
            ['id' => $id, 'user_id' => $userId]
        );
    }

    public function applyResolved(string $id, string $userId, string $note): void
    {
        $this->execute(
            "UPDATE critical_alerts SET status = 'resolved', resolved_at = now(), resolved_by_user_id = :user_id,
                    resolution_note = :note, next_escalation_at = NULL
             WHERE id = :id",
            ['id' => $id, 'user_id' => $userId, 'note' => $note]
        );
    }

    private function staffWhere(array $filters): array
    {
        $where = '';
        $params = [];
        $status = $filters['status'] ?? null;
        if ($status === 'active') {
            $where .= " AND ca.status IN ('open', 'notified', 'escalated')";
        } elseif (is_string($status) && $status !== '' && $status !== 'all') {
            $where .= ' AND ca.status = :status';
            $params['status'] = $status;
        }
        if (!empty($filters['flagged'])) {
            $where .= " AND ca.staff_flagged_at IS NOT NULL AND ca.status IN ('open', 'notified', 'escalated')";
        }
        if (!empty($filters['q'])) {
            $where .= ' AND p.full_name ILIKE :q';
            $params['q'] = '%' . addcslashes((string) $filters['q'], '%_\\') . '%';
        }
        return [$where, $params];
    }
}
