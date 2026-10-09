<?php

declare(strict_types=1);

namespace App\Models;

final class AuditLogRepository extends Model
{
    public function search(array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->where($filters);
        return $this->fetchAll(
            'SELECT a.id, a.actor_user_id, a.actor_role, u.full_name AS actor_name, a.action, a.entity_type, a.entity_id,
                    host(a.ip_address) AS ip_address, a.metadata, a.created_at
             FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id' . $where . '
             ORDER BY a.created_at DESC, a.id DESC LIMIT ' . $limit . ' OFFSET ' . $offset,
            $params
        );
    }

    public function count(array $filters): int
    {
        [$where, $params] = $this->where($filters);
        return (int) $this->fetchValue('SELECT count(*) FROM audit_log a' . $where, $params);
    }

    private function where(array $filters): array
    {
        $clauses = [];
        $params = [];
        if (isset($filters['action'])) {
            $clauses[] = '(a.action = :action OR a.action LIKE :action_prefix)';
            $params['action'] = $filters['action'];
            $params['action_prefix'] = ScanType::escapeLike((string) $filters['action']) . '.%';
        }
        if (isset($filters['actor_user_id'])) {
            $clauses[] = 'a.actor_user_id = :actor_user_id';
            $params['actor_user_id'] = $filters['actor_user_id'];
        }
        if (isset($filters['actor_role'])) {
            $clauses[] = 'a.actor_role = :actor_role';
            $params['actor_role'] = $filters['actor_role'];
        }
        if (isset($filters['entity_type'])) {
            $clauses[] = 'a.entity_type = :entity_type';
            $params['entity_type'] = $filters['entity_type'];
        }
        if (isset($filters['from'])) {
            $clauses[] = "a.created_at >= CAST(:from_date AS date)::timestamp AT TIME ZONE 'Asia/Kolkata'";
            $params['from_date'] = $filters['from'];
        }
        if (isset($filters['to'])) {
            $clauses[] = "a.created_at < (CAST(:to_date AS date) + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'";
            $params['to_date'] = $filters['to'];
        }
        return [$clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses), $params];
    }
}
