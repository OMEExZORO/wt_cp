<?php

declare(strict_types=1);

namespace App\Services\Alerts;

use App\Models\Model;

final class AlertPresenter
{
    public static function banner(array $row, string $audience): array
    {
        $forPatient = $audience === 'patient';
        return [
            'id' => $row['id'],
            'status' => $row['status'],
            'audience' => $audience,
            'title' => 'Important: your report needs attention',
            'message' => $forPatient
                ? sprintf('A finding in your %s report (reference %s) needs urgent attention. Please acknowledge this alert and contact the centre as soon as possible.', $row['scan_name'], $row['reference_code'])
                : sprintf('A finding in the %s report of your patient %s (reference %s) needs urgent attention. Please acknowledge this alert and contact the centre.', $row['scan_name'], $row['patient_name'], $row['reference_code']),
            'patient_name' => $forPatient ? null : $row['patient_name'],
            'scan_name' => $row['scan_name'],
            'reference_code' => $row['reference_code'],
            'requires_acknowledgement' => true,
            'created_at' => Model::iso($row['created_at']),
        ];
    }

    public static function staff(array $row): array
    {
        return [
            'id' => $row['id'],
            'status' => $row['status'],
            'escalation_level' => (int) $row['escalation_level'],
            'notify_count' => (int) $row['notify_count'],
            'red_flag' => AlertWorkflow::isRedFlagged($row),
            'staff_flagged_at' => Model::iso($row['staff_flagged_at']),
            'patient_name' => $row['patient_name'],
            'patient_phone' => $row['patient_phone'],
            'referrer_name' => $row['referrer_name'],
            'scan_name' => $row['scan_name'],
            'reference_code' => $row['reference_code'],
            'report_id' => $row['report_id'],
            'raised_by_name' => $row['raised_by_name'],
            'created_at' => Model::iso($row['created_at']),
            'last_notified_at' => Model::iso($row['last_notified_at']),
            'next_escalation_at' => Model::iso($row['next_escalation_at']),
            'acknowledged_at' => Model::iso($row['acknowledged_at']),
            'acknowledged_by_name' => $row['acknowledged_by_name'],
            'resolved_at' => Model::iso($row['resolved_at']),
            'resolved_by_name' => $row['resolved_by_name'],
            'resolution_note' => $row['resolution_note'],
        ];
    }

    public static function event(array $row): array
    {
        $details = $row['details'];
        if (is_string($details)) {
            $details = json_decode($details, true);
        }
        return [
            'id' => (int) $row['id'],
            'event_type' => $row['event_type'],
            'from_status' => $row['from_status'],
            'to_status' => $row['to_status'],
            'actor_type' => $row['actor_type'],
            'actor_name' => $row['actor_name'],
            'actor_role' => $row['actor_role'],
            'channel' => $row['channel'],
            'details' => is_array($details) ? $details : (object) [],
            'created_at' => Model::iso($row['created_at']),
        ];
    }
}
