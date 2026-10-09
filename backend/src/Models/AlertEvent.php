<?php

declare(strict_types=1);

namespace App\Models;

final class AlertEvent extends Model
{
    protected const TABLE = 'alert_events';
    protected const FILLABLE = ['alert_id', 'event_type', 'from_status', 'to_status', 'actor_type', 'actor_user_id', 'channel', 'details'];

    public function record(string $alertId, string $type, ?string $from, ?string $to, ?string $actorUserId, ?string $channel, array $details = []): void
    {
        $this->execute(
            'INSERT INTO alert_events (alert_id, event_type, from_status, to_status, actor_type, actor_user_id, channel, details)
             VALUES (:alert_id, :event_type, :from_status, :to_status, :actor_type, :actor_user_id, :channel, CAST(:details AS jsonb))',
            [
                'alert_id' => $alertId,
                'event_type' => $type,
                'from_status' => $from,
                'to_status' => $to,
                'actor_type' => $actorUserId === null ? 'system' : 'user',
                'actor_user_id' => $actorUserId,
                'channel' => $channel,
                'details' => json_encode($details === [] ? new \stdClass() : $details, JSON_THROW_ON_ERROR),
            ]
        );
    }

    public function forAlert(string $alertId): array
    {
        return $this->fetchAll(
            'SELECT e.id, e.event_type, e.from_status, e.to_status, e.actor_type, e.channel, e.details, e.created_at,
                    u.full_name AS actor_name, u.role AS actor_role
             FROM alert_events e
             LEFT JOIN users u ON u.id = e.actor_user_id
             WHERE e.alert_id = :alert_id
             ORDER BY e.created_at, e.id',
            ['alert_id' => $alertId]
        );
    }
}
