<?php

declare(strict_types=1);

namespace App\Models;

final class Report extends Model
{
    protected const TABLE = 'reports';
    protected const FILLABLE = [
        'appointment_id', 'patient_id', 'uploaded_by_user_id', 'title', 'original_filename', 'storage_path', 'mime_type',
        'size_bytes', 'sha256', 'encryption_iv', 'encryption_tag', 'key_version', 'findings_encrypted', 'impression_encrypted',
        'storage_driver', 'status', 'is_critical', 'released_at', 'deleted_at',
    ];

    public const STATUSES = ['draft', 'final', 'amended'];
    public const RELEASED_STATUSES = ['final', 'amended'];

    private const DETAIL = 'SELECT r.id, r.appointment_id, r.patient_id, r.uploaded_by_user_id, r.title, r.original_filename,
                r.storage_path, r.mime_type, r.size_bytes, r.sha256, r.encryption_iv, r.encryption_tag, r.key_version,
                r.findings_encrypted, r.impression_encrypted, r.storage_driver, r.status, r.is_critical, r.released_at,
                r.deleted_at, r.created_at, r.updated_at,
                p.full_name AS patient_name, p.user_id AS patient_user_id,
                a.reference_code AS appointment_reference, a.referral_id, a.status AS appointment_status,
                s.slot_date, t.name AS scan_name,
                rr.user_id AS referrer_user_id, rf.referrer_id,
                uu.full_name AS uploaded_by_name
            FROM reports r
            JOIN patients p ON p.id = r.patient_id
            JOIN appointments a ON a.id = r.appointment_id
            JOIN slots s ON s.id = a.slot_id
            JOIN scan_types t ON t.id = a.scan_type_id
            LEFT JOIN referrals rf ON rf.id = a.referral_id
            LEFT JOIN referrers rr ON rr.id = rf.referrer_id
            LEFT JOIN users uu ON uu.id = r.uploaded_by_user_id';

    public function findDetailed(string $id): ?array
    {
        return $this->fetchOne(self::DETAIL . ' WHERE r.id = :id AND r.deleted_at IS NULL', ['id' => $id]);
    }

    public function listVisible(array $user, array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->scope($user, $filters);
        $params['limit_rows'] = $limit;
        $params['offset_rows'] = $offset;
        return $this->fetchAll(
            self::DETAIL . ' WHERE r.deleted_at IS NULL' . $where . ' ORDER BY r.created_at DESC LIMIT :limit_rows OFFSET :offset_rows',
            $params
        );
    }

    public function countVisible(array $user, array $filters): int
    {
        [$where, $params] = $this->scope($user, $filters);
        return (int) $this->fetchValue(
            'SELECT count(*) FROM reports r
             JOIN patients p ON p.id = r.patient_id
             JOIN appointments a ON a.id = r.appointment_id
             LEFT JOIN referrals rf ON rf.id = a.referral_id
             LEFT JOIN referrers rr ON rr.id = rf.referrer_id
             WHERE r.deleted_at IS NULL' . $where,
            $params
        );
    }

    public function releasedForReferral(string $referralId): array
    {
        return $this->fetchAll(
            self::DETAIL . " WHERE r.deleted_at IS NULL AND a.referral_id = :referral_id AND r.status IN ('final', 'amended') ORDER BY r.created_at DESC",
            ['referral_id' => $referralId]
        );
    }

    public function allForReferral(string $referralId): array
    {
        return $this->fetchAll(
            self::DETAIL . ' WHERE r.deleted_at IS NULL AND a.referral_id = :referral_id ORDER BY r.created_at DESC',
            ['referral_id' => $referralId]
        );
    }

    public function markDeleted(string $id): void
    {
        $this->execute('UPDATE reports SET deleted_at = now() WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
    }

    public function hasReleasedForReferral(string $referralId): bool
    {
        return Model::flag($this->fetchValue(
            "SELECT EXISTS (SELECT 1 FROM reports r JOIN appointments a ON a.id = r.appointment_id
             WHERE a.referral_id = :referral_id AND r.deleted_at IS NULL AND r.status IN ('final', 'amended'))",
            ['referral_id' => $referralId]
        ));
    }

    private function scope(array $user, array $filters): array
    {
        $where = '';
        $params = [];
        $role = (string) ($user['role'] ?? '');
        if ($role === 'patient') {
            $where .= " AND p.user_id = :scope_user_id AND r.status IN ('final', 'amended')";
            $params['scope_user_id'] = $user['id'];
        } elseif ($role === 'referrer') {
            $where .= " AND rr.user_id = :scope_user_id AND r.status IN ('final', 'amended')";
            $params['scope_user_id'] = $user['id'];
        } elseif (!in_array($role, ['receptionist', 'doctor', 'admin'], true)) {
            return [' AND FALSE', []];
        }
        if (!empty($filters['patient_id'])) {
            $where .= ' AND r.patient_id = :patient_id';
            $params['patient_id'] = $filters['patient_id'];
        }
        if (!empty($filters['appointment_id'])) {
            $where .= ' AND r.appointment_id = :appointment_id';
            $params['appointment_id'] = $filters['appointment_id'];
        }
        if (!empty($filters['status'])) {
            $where .= ' AND r.status = :status';
            $params['status'] = $filters['status'];
        }
        if (!empty($filters['q'])) {
            $where .= ' AND (r.title ILIKE :q OR p.full_name ILIKE :q OR a.reference_code ILIKE :q)';
            $params['q'] = '%' . addcslashes((string) $filters['q'], '%_\\') . '%';
        }
        if (!empty($filters['from'])) {
            $where .= ' AND r.created_at >= CAST(:from_date AS date)';
            $params['from_date'] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where .= " AND r.created_at < CAST(:to_date AS date) + INTERVAL '1 day'";
            $params['to_date'] = $filters['to'];
        }
        return [$where, $params];
    }
}
