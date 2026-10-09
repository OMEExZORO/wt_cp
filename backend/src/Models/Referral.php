<?php

declare(strict_types=1);

namespace App\Models;

final class Referral extends Model
{
    protected const TABLE = 'referrals';
    protected const FILLABLE = [
        'reference_code', 'referrer_id', 'patient_id', 'patient_name', 'patient_phone', 'patient_email', 'scan_type_id',
        'preferred_branch_id', 'urgency', 'status', 'clinical_notes_encrypted', 'status_changed_at',
    ];

    public const STATUSES = ['submitted', 'accepted', 'scheduled', 'completed', 'report_ready', 'declined', 'cancelled'];
    public const STAFF_STATUSES = ['accepted', 'scheduled', 'completed', 'report_ready', 'declined', 'cancelled'];
    public const URGENCIES = ['Routine', 'Priority', 'Urgent'];

    private const DETAIL = 'SELECT rf.id, rf.reference_code, rf.referrer_id, rf.patient_id, rf.patient_name, rf.patient_phone,
                rf.patient_email, rf.scan_type_id, rf.preferred_branch_id, rf.urgency, rf.status, rf.clinical_notes_encrypted,
                rf.status_changed_at, rf.created_at, rf.updated_at,
                rr.user_id AS referrer_user_id, rr.full_name AS referrer_name, rr.clinic_name AS referrer_clinic,
                t.name AS scan_name, t.modality AS scan_modality,
                b.name AS branch_name,
                ap.id AS appointment_id, ap.reference_code AS appointment_reference, ap.status AS appointment_status,
                ap.slot_date AS appointment_date, ap.start_time AS appointment_time
            FROM referrals rf
            JOIN referrers rr ON rr.id = rf.referrer_id
            LEFT JOIN scan_types t ON t.id = rf.scan_type_id
            LEFT JOIN branches b ON b.id = rf.preferred_branch_id
            LEFT JOIN LATERAL (
                SELECT a.id, a.reference_code, a.status, s.slot_date, s.start_time
                FROM appointments a JOIN slots s ON s.id = a.slot_id
                WHERE a.referral_id = rf.id AND a.status <> \'cancelled\'
                ORDER BY s.slot_date DESC, s.start_time DESC LIMIT 1
            ) ap ON TRUE';

    public function findDetailed(string $id): ?array
    {
        return $this->fetchOne(self::DETAIL . ' WHERE rf.id = :id', ['id' => $id]);
    }

    public function list(array $filters, ?string $referrerId, int $limit, int $offset): array
    {
        [$where, $params] = $this->scope($filters, $referrerId);
        $params['limit_rows'] = $limit;
        $params['offset_rows'] = $offset;
        return $this->fetchAll(
            self::DETAIL . ' WHERE TRUE' . $where . ' ORDER BY rf.created_at DESC LIMIT :limit_rows OFFSET :offset_rows',
            $params
        );
    }

    public function count(array $filters, ?string $referrerId): int
    {
        [$where, $params] = $this->scope($filters, $referrerId);
        return (int) $this->fetchValue('SELECT count(*) FROM referrals rf WHERE TRUE' . $where, $params);
    }

    public function referenceExists(string $code): bool
    {
        return Model::flag($this->fetchValue('SELECT EXISTS (SELECT 1 FROM referrals WHERE reference_code = :code)', ['code' => $code]));
    }

    public function linkAppointment(string $referralId, string $appointmentId): void
    {
        $this->execute('UPDATE appointments SET referral_id = :referral_id WHERE id = :id', ['referral_id' => $referralId, 'id' => $appointmentId]);
    }

    private function scope(array $filters, ?string $referrerId): array
    {
        $where = '';
        $params = [];
        if ($referrerId !== null) {
            $where .= ' AND rf.referrer_id = :referrer_id';
            $params['referrer_id'] = $referrerId;
        }
        if (!empty($filters['status'])) {
            $where .= ' AND rf.status = :status';
            $params['status'] = $filters['status'];
        }
        if (!empty($filters['q'])) {
            $where .= ' AND (rf.patient_name ILIKE :q OR rf.reference_code ILIKE :q)';
            $params['q'] = '%' . addcslashes((string) $filters['q'], '%_\\') . '%';
        }
        return [$where, $params];
    }
}
