<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Logger;
use App\Core\Request;
use PDO;
use Throwable;

final class DatabaseAuditLogger implements AuditLogger
{
    public function __construct(private readonly PDO $db, private readonly Logger $logger)
    {
    }

    public function log(string $action, ?Request $request = null, array $options = []): void
    {
        $actor = $options['actor'] ?? $request?->user();
        try {
            $statement = $this->db->prepare(
                'INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, ip_address, user_agent, metadata)
                 VALUES (:actor_user_id, :actor_role, :action, :entity_type, :entity_id, :ip_address, :user_agent, CAST(:metadata AS jsonb))'
            );
            $statement->execute([
                'actor_user_id' => is_array($actor) ? ($actor['id'] ?? null) : null,
                'actor_role' => is_array($actor) ? ($actor['role'] ?? null) : null,
                'action' => $action,
                'entity_type' => $options['entity_type'] ?? null,
                'entity_id' => isset($options['entity_id']) ? (string) $options['entity_id'] : null,
                'ip_address' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
                'metadata' => json_encode(
                    array_merge($options['metadata'] ?? [], $request !== null ? ['path' => $request->path(), 'method' => $request->method()] : []),
                    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
                ),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Audit log write failed', ['action' => $action, 'error' => $e->getMessage()]);
        }
    }
}
