<?php

declare(strict_types=1);

namespace App\Models;

final class ReportAccessLog extends Model
{
    protected const TABLE = 'report_access_log';
    protected const FILLABLE = ['report_id', 'user_id', 'action', 'ip_address', 'user_agent'];

    public const ACTIONS = ['upload', 'view', 'download', 'delete', 'denied'];

    public function record(string $reportId, ?string $userId, string $action, ?string $ip, ?string $userAgent): void
    {
        $this->execute(
            'INSERT INTO report_access_log (report_id, user_id, action, ip_address, user_agent)
             VALUES (:report_id, :user_id, :action, :ip_address, :user_agent)',
            ['report_id' => $reportId, 'user_id' => $userId, 'action' => $action, 'ip_address' => $ip, 'user_agent' => $userAgent]
        );
    }

    public function forReport(string $reportId, int $limit = 100): array
    {
        return $this->fetchAll(
            'SELECT l.id, l.action, l.created_at, l.ip_address, u.full_name AS user_name, u.role AS user_role
             FROM report_access_log l LEFT JOIN users u ON u.id = l.user_id
             WHERE l.report_id = :report_id ORDER BY l.created_at DESC LIMIT :limit_rows',
            ['report_id' => $reportId, 'limit_rows' => $limit]
        );
    }
}
