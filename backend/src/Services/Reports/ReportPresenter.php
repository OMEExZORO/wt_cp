<?php

declare(strict_types=1);

namespace App\Services\Reports;

use App\Models\Model;
use App\Services\EncryptionService;

final class ReportPresenter
{
    public function __construct(private readonly EncryptionService $crypto)
    {
    }

    public function summary(array $row): array
    {
        return [
            'id' => $row['id'],
            'title' => $row['title'],
            'status' => $row['status'],
            'mime_type' => $row['mime_type'],
            'size_bytes' => (int) $row['size_bytes'],
            'original_filename' => $row['original_filename'],
            'is_critical' => Model::flag($row['is_critical']),
            'patient' => ['id' => $row['patient_id'], 'name' => $row['patient_name']],
            'appointment' => [
                'id' => $row['appointment_id'],
                'reference_code' => $row['appointment_reference'],
                'scan_name' => $row['scan_name'],
                'date' => $row['slot_date'],
            ],
            'released_at' => Model::iso($row['released_at'] ?? null),
            'created_at' => Model::iso($row['created_at']),
            'updated_at' => Model::iso($row['updated_at']),
        ];
    }

    public function detail(array $row, array $user): array
    {
        $data = $this->summary($row);
        $data['uploaded_by'] = $row['uploaded_by_name'] ?? null;
        $data['has_referrer'] = !empty($row['referrer_id']);
        if (ReportAccessPolicy::canSeeClinicalText($user)) {
            $data['notes'] = $this->crypto->decryptNullable($row['findings_encrypted'] ?? null);
            $data['impression'] = $this->crypto->decryptNullable($row['impression_encrypted'] ?? null);
        }
        return $data;
    }
}
