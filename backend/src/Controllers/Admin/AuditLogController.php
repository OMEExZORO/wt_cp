<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ValidationException;
use App\Models\AuditLogRepository;
use App\Models\Model;
use App\Services\AuditLogger;

final class AuditLogController extends AdminController
{
    public function __construct(AuditLogger $audit, private readonly AuditLogRepository $log)
    {
        parent::__construct($audit);
    }

    public function index(Request $request): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request);
        $filters = $this->validate($request, [
            'action' => ['nullable', 'max:80', 'regex:/^[a-z_]+(\.[a-z_]+)*$/'],
            'actor_user_id' => 'nullable|uuid',
            'actor_role' => 'nullable|in:patient,receptionist,doctor,admin,referrer',
            'entity_type' => ['nullable', 'max:60', 'regex:/^[a-z_]+$/'],
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);
        $filters = array_filter($filters, static fn (mixed $value): bool => $value !== null);
        if (isset($filters['from'], $filters['to']) && $filters['to'] < $filters['from']) {
            throw ValidationException::withField('to', 'The end date must not be before the start date.');
        }
        $rows = array_map(static function (array $row): array {
            $metadata = json_decode((string) $row['metadata'], true);
            return [
                'id' => (int) $row['id'],
                'actor_user_id' => $row['actor_user_id'],
                'actor_name' => $row['actor_name'],
                'actor_role' => $row['actor_role'],
                'action' => $row['action'],
                'entity_type' => $row['entity_type'],
                'entity_id' => $row['entity_id'],
                'ip_address' => $row['ip_address'],
                'metadata' => is_array($metadata) ? $metadata : [],
                'created_at' => Model::iso($row['created_at']),
            ];
        }, $this->log->search($filters, $perPage, $offset));
        return $this->paged('entries', $rows, $this->log->count($filters), $page, $perPage);
    }
}
