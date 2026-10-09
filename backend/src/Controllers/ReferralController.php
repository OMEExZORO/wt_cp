<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\AuthorizationException;
use App\Exceptions\NotFoundException;
use App\Exceptions\ValidationException;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Model;
use App\Models\Referral;
use App\Models\Referrer;
use App\Models\Report;
use App\Models\ScanType;
use App\Services\AuditLogger;
use App\Services\EncryptionService;
use App\Services\Reports\ReportPresenter;

final class ReferralController extends Controller
{
    private const STAFF_ROLES = ['receptionist', 'doctor', 'admin'];
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    public function __construct(
        private readonly Referral $referrals,
        private readonly Referrer $referrers,
        private readonly ScanType $scanTypes,
        private readonly Branch $branches,
        private readonly Appointment $appointments,
        private readonly Report $reports,
        private readonly ReportPresenter $reportPresenter,
        private readonly EncryptionService $crypto,
        private readonly AuditLogger $audit
    ) {
    }

    public function index(Request $request): Response
    {
        $user = $this->user($request);
        $filters = $this->validate($request, [
            'status' => 'nullable|in:' . implode(',', Referral::STATUSES),
            'q' => 'nullable|string|max:80',
            'page' => 'nullable|integer|min:1|max:1000',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        $referrerId = $this->scopeReferrerId($user);
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 20);
        $rows = $this->referrals->list($filters, $referrerId, $perPage, ($page - 1) * $perPage);
        $total = $this->referrals->count($filters, $referrerId);
        $items = array_map(fn (array $row): array => $this->present($row, $user, true), $rows);
        return $this->ok(['referrals' => $items], 200, ['page' => $page, 'per_page' => $perPage, 'total' => $total]);
    }

    public function store(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, [
            'patient_name' => 'required|name|min:2|max:120',
            'patient_phone' => 'required|phone',
            'patient_email' => 'nullable|email|max:254',
            'scan_type_id' => 'required|uuid',
            'preferred_branch_id' => 'nullable|uuid',
            'urgency' => 'nullable|in:' . implode(',', Referral::URGENCIES),
            'clinical_notes' => 'nullable|text|max:2000',
        ]);
        $referrer = $this->referrers->findByUserId((string) $user['id']);
        if ($referrer === null) {
            throw new AuthorizationException('Your referrer profile is not set up.');
        }
        $errors = [];
        if ($this->scanTypes->find($data['scan_type_id']) === null) {
            $errors['scan_type_id'] = 'Choose a scan from the list.';
        }
        if (!empty($data['preferred_branch_id']) && $this->branches->findActive($data['preferred_branch_id']) === null) {
            $errors['preferred_branch_id'] = 'Choose a branch from the list.';
        }
        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        $created = $this->referrals->create([
            'reference_code' => $this->uniqueCode(),
            'referrer_id' => $referrer['id'],
            'patient_name' => $data['patient_name'],
            'patient_phone' => $data['patient_phone'],
            'patient_email' => $data['patient_email'] ?? null,
            'scan_type_id' => $data['scan_type_id'],
            'preferred_branch_id' => $data['preferred_branch_id'] ?? null,
            'urgency' => $data['urgency'] ?? 'Routine',
            'clinical_notes_encrypted' => $this->crypto->encryptNullable($data['clinical_notes'] ?? null),
        ]);
        $this->audit->log('referral.created', $request, [
            'entity_type' => 'referral',
            'entity_id' => $created['id'],
            'metadata' => ['reference' => $created['reference_code'], 'scan_type_id' => $data['scan_type_id'], 'urgency' => $created['urgency']],
        ]);
        $row = $this->referrals->findDetailed((string) $created['id']) ?? throw new NotFoundException('Referral not found.');
        return $this->created(['referral' => $this->present($row, $user, true)]);
    }

    public function show(Request $request): Response
    {
        $user = $this->user($request);
        $row = $this->authorized($request, $user);
        return $this->ok(['referral' => $this->present($row, $user, true)]);
    }

    public function update(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, [
            'status' => 'sometimes|required|in:' . implode(',', Referral::STAFF_STATUSES),
            'appointment_id' => 'sometimes|required|uuid',
        ]);
        if ($data === []) {
            throw new ValidationException(['status' => 'Choose a new status or an appointment to link.']);
        }
        $row = $this->authorized($request, $user);

        $appointment = null;
        if (isset($data['appointment_id'])) {
            $appointment = $this->appointments->findDetailed($data['appointment_id']);
            if ($appointment === null || $appointment['status'] === 'cancelled') {
                throw ValidationException::withField('appointment_id', 'Choose an existing, non-cancelled appointment.');
            }
            if (!empty($appointment['referral_id']) && (string) $appointment['referral_id'] !== (string) $row['id']) {
                throw ValidationException::withField('appointment_id', 'This appointment is already linked to another referral.');
            }
            if (!empty($row['patient_id']) && (string) $row['patient_id'] !== (string) $appointment['patient_id']) {
                throw ValidationException::withField('appointment_id', 'This appointment belongs to a different patient.');
            }
        }

        $status = $data['status'] ?? null;
        if ($status === null && $appointment !== null && in_array($row['status'], ['submitted', 'accepted'], true)) {
            $status = 'scheduled';
        }

        $this->referrals->transaction(function () use ($row, $appointment, $status): void {
            $changes = [];
            if ($appointment !== null) {
                $this->referrals->linkAppointment((string) $row['id'], (string) $appointment['id']);
                $changes['patient_id'] = $appointment['patient_id'];
            }
            if ($status !== null && $status !== $row['status']) {
                $changes['status'] = $status;
                $changes['status_changed_at'] = date(\DateTimeInterface::ATOM);
            }
            if ($changes !== []) {
                $this->referrals->update((string) $row['id'], $changes);
            }
        });

        $this->audit->log('referral.updated', $request, [
            'entity_type' => 'referral',
            'entity_id' => $row['id'],
            'metadata' => [
                'reference' => $row['reference_code'],
                'from_status' => $row['status'],
                'to_status' => $status ?? $row['status'],
                'appointment_id' => $appointment['id'] ?? null,
            ],
        ]);
        $updated = $this->referrals->findDetailed((string) $row['id']) ?? throw new NotFoundException('Referral not found.');
        return $this->ok(['referral' => $this->present($updated, $user, true)]);
    }

    private function authorized(Request $request, array $user): array
    {
        $row = $this->referrals->findDetailed((string) $request->param('id'));
        if ($row === null) {
            throw new NotFoundException('Referral not found.');
        }
        if (in_array($user['role'], self::STAFF_ROLES, true)) {
            return $row;
        }
        if ($user['role'] === 'referrer' && (string) $row['referrer_user_id'] === (string) $user['id']) {
            return $row;
        }
        throw new NotFoundException('Referral not found.');
    }

    private function scopeReferrerId(array $user): ?string
    {
        if (in_array($user['role'], self::STAFF_ROLES, true)) {
            return null;
        }
        $referrer = $this->referrers->findByUserId((string) $user['id']);
        if ($referrer === null) {
            throw new AuthorizationException('Your referrer profile is not set up.');
        }
        return (string) $referrer['id'];
    }

    private function present(array $row, array $user, bool $withReports): array
    {
        $isStaff = in_array($user['role'], self::STAFF_ROLES, true);
        $data = [
            'id' => $row['id'],
            'reference_code' => $row['reference_code'],
            'patient_name' => $row['patient_name'],
            'patient_phone' => $row['patient_phone'],
            'patient_email' => $row['patient_email'],
            'scan_type' => $row['scan_type_id'] === null ? null : ['id' => $row['scan_type_id'], 'name' => $row['scan_name'], 'modality' => $row['scan_modality']],
            'preferred_branch' => $row['preferred_branch_id'] === null ? null : ['id' => $row['preferred_branch_id'], 'name' => $row['branch_name']],
            'urgency' => $row['urgency'],
            'status' => $row['status'],
            'status_changed_at' => Model::iso($row['status_changed_at']),
            'created_at' => Model::iso($row['created_at']),
            'appointment' => $row['appointment_id'] === null ? null : [
                'id' => $row['appointment_id'],
                'reference_code' => $row['appointment_reference'],
                'status' => $row['appointment_status'],
                'date' => $row['appointment_date'],
                'time' => isset($row['appointment_time']) ? substr((string) $row['appointment_time'], 0, 5) : null,
            ],
            'clinical_notes' => $this->crypto->decryptNullable($row['clinical_notes_encrypted'] ?? null),
        ];
        if ($isStaff) {
            $data['referrer'] = ['name' => $row['referrer_name'], 'clinic_name' => $row['referrer_clinic']];
        }
        if ($withReports) {
            $reports = $isStaff ? $this->reports->allForReferral((string) $row['id']) : $this->reports->releasedForReferral((string) $row['id']);
            $data['reports'] = array_map(fn (array $report): array => $this->reportPresenter->summary($report), $reports);
        }
        return $data;
    }

    private function uniqueCode(): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $suffix = '';
            for ($i = 0; $i < 6; $i++) {
                $suffix .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
            $code = 'RF-' . date('ymd') . '-' . $suffix;
            if (!$this->referrals->referenceExists($code)) {
                return $code;
            }
        }
        throw new \RuntimeException('Could not allocate a referral reference.');
    }
}
