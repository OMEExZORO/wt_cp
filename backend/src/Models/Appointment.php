<?php

declare(strict_types=1);

namespace App\Models;

final class Appointment extends Model
{
    protected const TABLE = 'appointments';
    protected const FILLABLE = [
        'reference_code', 'patient_id', 'slot_id', 'branch_id', 'scan_type_id', 'referral_id', 'booked_by_user_id',
        'rescheduled_from_id', 'status', 'urgency', 'patient_notes', 'consent_given_at', 'checked_in_at', 'completed_at',
        'cancelled_at', 'cancellation_reason', 'reminder_sent_at', 'calendar_sequence', 'rescheduled_at', 'urgency_updated_at',
    ];

    public const STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];
    public const ACTIVE_STATUSES = ['pending', 'confirmed'];
    public const URGENCIES = ['Routine', 'Priority', 'Urgent'];

    private const DETAIL = 'SELECT a.id, a.reference_code, a.patient_id, a.slot_id, a.branch_id, a.scan_type_id, a.referral_id,
                a.booked_by_user_id, a.status, a.urgency, a.patient_notes, a.consent_given_at, a.checked_in_at, a.completed_at,
                a.cancelled_at, a.cancellation_reason, a.reminder_sent_at, a.calendar_sequence, a.rescheduled_at,
                a.urgency_updated_at, a.created_at, a.updated_at,
                s.slot_date, s.start_time, s.end_time, s.modality,
                b.name AS branch_name, b.slug AS branch_slug, b.address_line AS branch_address_line, b.landmark AS branch_landmark,
                b.area AS branch_area, b.city AS branch_city, b.state AS branch_state, b.postal_code AS branch_postal_code,
                b.phone AS branch_phone, b.maps_url AS branch_maps_url,
                t.name AS scan_name, t.slug AS scan_slug, t.preparation_tips, t.duration_minutes,
                p.full_name AS patient_name, p.phone AS patient_phone, p.user_id AS patient_user_id,
                COALESCE(u.email, p.email) AS patient_email,
                bu.role AS booked_by_role,
                (SELECT count(*) FROM appointment_checklist_answers ca WHERE ca.appointment_id = a.id AND ca.needs_attention) AS attention_count
            FROM appointments a
            JOIN slots s ON s.id = a.slot_id
            JOIN branches b ON b.id = a.branch_id
            JOIN scan_types t ON t.id = a.scan_type_id
            JOIN patients p ON p.id = a.patient_id
            LEFT JOIN users u ON u.id = p.user_id
            LEFT JOIN users bu ON bu.id = a.booked_by_user_id';

    private const URGENCY_RANK = "CASE a.urgency WHEN 'Urgent' THEN 0 WHEN 'Priority' THEN 1 ELSE 2 END";

    public function findDetailed(string $id): ?array
    {
        return $this->fetchOne(self::DETAIL . ' WHERE a.id = :id', ['id' => $id]);
    }

    public function listForPatient(string $patientId, string $scope, string $today, string $nowTime): array
    {
        [$where, $params] = $this->scopeClause($scope, $today, $nowTime);
        $order = $scope === 'past' ? 's.slot_date DESC, s.start_time DESC' : 's.slot_date, s.start_time';
        $params['patient_id'] = $patientId;
        return $this->fetchAll(
            self::DETAIL . ' WHERE a.patient_id = :patient_id' . $where . ' ORDER BY ' . $order . ' LIMIT 200',
            $params
        );
    }

    public function listForStaff(array $filters, string $today, string $nowTime, int $limit, int $offset): array
    {
        [$where, $params] = $this->staffWhere($filters, $today, $nowTime);
        $order = ($filters['scope'] ?? 'all') === 'past'
            ? 's.slot_date DESC, s.start_time DESC'
            : 's.slot_date, s.start_time, ' . self::URGENCY_RANK . ', a.created_at';
        $params['limit_rows'] = $limit;
        $params['offset_rows'] = $offset;
        return $this->fetchAll(
            self::DETAIL . ' WHERE TRUE' . $where . ' ORDER BY ' . $order . ' LIMIT :limit_rows OFFSET :offset_rows',
            $params
        );
    }

    public function countForStaff(array $filters, string $today, string $nowTime): int
    {
        [$where, $params] = $this->staffWhere($filters, $today, $nowTime);
        return (int) $this->fetchValue(
            'SELECT count(*) FROM appointments a JOIN slots s ON s.id = a.slot_id JOIN patients p ON p.id = a.patient_id WHERE TRUE' . $where,
            $params
        );
    }

    public function lockForUpdate(string $id): ?array
    {
        return $this->fetchOne(
            'SELECT a.*, t.modality, s.slot_date, s.start_time, s.end_time
             FROM appointments a
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN slots s ON s.id = a.slot_id
             WHERE a.id = :id FOR UPDATE OF a',
            ['id' => $id]
        );
    }

    public function hasActiveInSlot(string $patientId, string $slotId, ?string $exceptId = null): bool
    {
        $sql = "SELECT EXISTS (SELECT 1 FROM appointments WHERE patient_id = :patient_id AND slot_id = :slot_id AND status <> 'cancelled'";
        $params = ['patient_id' => $patientId, 'slot_id' => $slotId];
        if ($exceptId !== null) {
            $sql .= ' AND id <> :except_id';
            $params['except_id'] = $exceptId;
        }
        return Model::flag($this->fetchValue($sql . ')', $params));
    }

    public function moveToSlot(string $id, string $slotId, string $branchId): void
    {
        $this->execute(
            'UPDATE appointments
             SET slot_id = :slot_id, branch_id = :branch_id, rescheduled_at = now(), reminder_sent_at = NULL,
                 calendar_sequence = calendar_sequence + 1
             WHERE id = :id',
            ['id' => $id, 'slot_id' => $slotId, 'branch_id' => $branchId]
        );
    }

    public function markCancelled(string $id, ?string $reason): void
    {
        $this->execute(
            "UPDATE appointments
             SET status = 'cancelled', cancelled_at = now(), cancellation_reason = :reason, calendar_sequence = calendar_sequence + 1
             WHERE id = :id",
            ['id' => $id, 'reason' => $reason]
        );
    }

    public function applyStatus(string $id, ?string $status, ?string $urgency): void
    {
        $sets = [];
        $params = ['id' => $id];
        if ($status !== null) {
            $sets[] = 'status = :status';
            $params['status'] = $status;
            if ($status === 'checked_in') {
                $sets[] = 'checked_in_at = COALESCE(checked_in_at, now())';
            }
            if ($status === 'completed') {
                $sets[] = 'completed_at = now()';
                $sets[] = 'checked_in_at = COALESCE(checked_in_at, now())';
            }
        }
        if ($urgency !== null) {
            $sets[] = 'urgency = :urgency';
            $sets[] = 'urgency_updated_at = now()';
            $params['urgency'] = $urgency;
        }
        if ($sets === []) {
            return;
        }
        $this->execute('UPDATE appointments SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function referenceExists(string $code): bool
    {
        return Model::flag($this->fetchValue('SELECT EXISTS (SELECT 1 FROM appointments WHERE reference_code = :code)', ['code' => $code]));
    }

    private function scopeClause(string $scope, string $today, string $nowTime): array
    {
        $params = [];
        $where = '';
        if ($scope === 'upcoming') {
            $where = " AND a.status IN ('pending', 'confirmed', 'checked_in', 'in_progress') AND (s.slot_date, s.end_time) >= (CAST(:today AS date), CAST(:now_time AS time))";
            $params = ['today' => $today, 'now_time' => $nowTime];
        } elseif ($scope === 'past') {
            $where = " AND (a.status IN ('completed', 'cancelled', 'no_show') OR (s.slot_date, s.end_time) < (CAST(:today AS date), CAST(:now_time AS time)))";
            $params = ['today' => $today, 'now_time' => $nowTime];
        }
        return [$where, $params];
    }

    private function staffWhere(array $filters, string $today, string $nowTime): array
    {
        [$where, $params] = $this->scopeClause((string) ($filters['scope'] ?? 'all'), $today, $nowTime);
        if (($filters['date'] ?? null) !== null) {
            $where .= ' AND s.slot_date = CAST(:date AS date)';
            $params['date'] = $filters['date'];
        }
        if (($filters['from'] ?? null) !== null) {
            $where .= ' AND s.slot_date >= CAST(:from_date AS date)';
            $params['from_date'] = $filters['from'];
        }
        if (($filters['to'] ?? null) !== null) {
            $where .= ' AND s.slot_date <= CAST(:to_date AS date)';
            $params['to_date'] = $filters['to'];
        }
        if (($filters['branch_id'] ?? null) !== null) {
            $where .= ' AND a.branch_id = :branch_id';
            $params['branch_id'] = $filters['branch_id'];
        }
        if (($filters['status'] ?? null) !== null) {
            $where .= ' AND a.status = :status';
            $params['status'] = $filters['status'];
        }
        if (($filters['urgency'] ?? null) !== null) {
            $where .= ' AND a.urgency = :urgency';
            $params['urgency'] = $filters['urgency'];
        }
        if (($filters['q'] ?? null) !== null) {
            $where .= ' AND (p.full_name ILIKE :q OR a.reference_code ILIKE :q OR p.phone ILIKE :q)';
            $params['q'] = '%' . ScanType::escapeLike((string) $filters['q']) . '%';
        }
        return [$where, $params];
    }
}
