<?php

declare(strict_types=1);

namespace App\Services\Alerts;

use App\Exceptions\ConflictException;

final class AlertWorkflow
{
    public const OPEN_STATUSES = ['open', 'notified', 'escalated'];
    public const RESOLVABLE = ['open', 'notified', 'escalated', 'acknowledged'];
    public const STAFF_ROLES = ['receptionist', 'doctor', 'admin'];

    private const TRANSITIONS = [
        'open' => ['notified', 'escalated', 'acknowledged', 'resolved', 'cancelled'],
        'notified' => ['escalated', 'acknowledged', 'resolved', 'cancelled'],
        'escalated' => ['acknowledged', 'resolved', 'cancelled'],
        'acknowledged' => ['resolved'],
        'resolved' => [],
        'cancelled' => [],
    ];

    public static function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public static function assertTransition(string $from, string $to): void
    {
        if (!self::canTransition($from, $to)) {
            throw new ConflictException(sprintf('An alert that is %s cannot become %s.', $from, $to));
        }
    }

    public static function isOpen(string $status): bool
    {
        return in_array($status, self::OPEN_STATUSES, true);
    }

    public static function mayAcknowledge(array $user, array $alert): bool
    {
        $userId = (string) ($user['id'] ?? '');
        if ($userId === '') {
            return false;
        }
        return match ($user['role'] ?? null) {
            'patient' => (string) ($alert['patient_user_id'] ?? '') === $userId,
            'referrer' => (string) ($alert['referrer_user_id'] ?? '') === $userId,
            default => false,
        };
    }

    public static function isRedFlagged(array $alert): bool
    {
        return !empty($alert['staff_flagged_at']) && self::isOpen((string) $alert['status']);
    }
}
