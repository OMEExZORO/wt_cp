<?php

declare(strict_types=1);

namespace App\Services\Reports;

final class ReportAccessPolicy
{
    public const STAFF_ROLES = ['receptionist', 'doctor', 'admin'];
    public const RELEASED_STATUSES = ['final', 'amended'];

    public static function canView(array $user, array $report): bool
    {
        if (!empty($report['deleted_at'])) {
            return false;
        }
        $role = (string) ($user['role'] ?? '');
        $userId = (string) ($user['id'] ?? '');
        if ($userId === '') {
            return false;
        }
        if (in_array($role, self::STAFF_ROLES, true)) {
            return true;
        }
        if (!in_array((string) ($report['status'] ?? ''), self::RELEASED_STATUSES, true)) {
            return false;
        }
        if ($role === 'patient') {
            return (string) ($report['patient_user_id'] ?? '') === $userId;
        }
        if ($role === 'referrer') {
            return (string) ($report['referrer_user_id'] ?? '') === $userId;
        }
        return false;
    }

    public static function canManage(array $user): bool
    {
        return in_array((string) ($user['role'] ?? ''), self::STAFF_ROLES, true);
    }

    public static function canDelete(array $user): bool
    {
        return ($user['role'] ?? null) === 'admin';
    }

    public static function canSeeClinicalText(array $user): bool
    {
        return in_array((string) ($user['role'] ?? ''), ['doctor', 'admin', 'receptionist'], true);
    }
}
