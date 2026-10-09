<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\NotFoundException;
use App\Models\AlertEvent;
use App\Models\CriticalAlert;
use App\Models\Model;
use App\Services\Alerts\AlertPresenter;
use App\Services\Alerts\AlertService;
use App\Services\Alerts\AlertWorkflow;
use App\Services\AuditLogger;

final class AlertController extends Controller
{
    public function __construct(
        private readonly CriticalAlert $alerts,
        private readonly AlertEvent $events,
        private readonly AlertService $service,
        private readonly AuditLogger $audit
    ) {
    }

    public function flag(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, ['note' => 'nullable|text|max:1000']);
        $alert = $this->service->raise($user, (string) $request->param('id'), $data['note'] ?? null);
        $this->audit->log('alert.raised', $request, [
            'entity_type' => 'critical_alert',
            'entity_id' => $alert['id'],
            'metadata' => ['report_id' => $alert['report_id']],
        ]);
        return $this->created([
            'alert' => AlertPresenter::staff($alert),
            'note_stored' => ($data['note'] ?? null) !== null && $this->service->noteStorageAvailable(),
        ]);
    }

    public function mine(Request $request): Response
    {
        $user = $this->user($request);
        $rows = $this->alerts->listUnacknowledgedForUser((string) $user['id'], (string) $user['role']);
        $audience = $user['role'] === 'referrer' ? 'referrer' : 'patient';
        return $this->ok(['alerts' => array_map(static fn (array $row): array => AlertPresenter::banner($row, $audience), $rows)]);
    }

    public function index(Request $request): Response
    {
        $filters = $this->validate($request, [
            'status' => 'nullable|in:active,all,open,notified,escalated,acknowledged,resolved,cancelled',
            'flagged' => 'nullable|boolean',
            'q' => 'nullable|string|max:80',
            'page' => 'nullable|integer|min:1',
        ]);
        $page = (int) ($filters['page'] ?? 1);
        $perPage = 25;
        $rows = $this->alerts->listForStaff($filters, $perPage, ($page - 1) * $perPage);
        return $this->ok(
            ['alerts' => array_map(static fn (array $row): array => AlertPresenter::staff($row), $rows)],
            200,
            ['page' => $page, 'per_page' => $perPage, 'total' => $this->alerts->countForStaff($filters)]
        );
    }

    public function events(Request $request): Response
    {
        $alert = $this->alerts->findDetailed((string) $request->param('id'));
        if ($alert === null) {
            throw new NotFoundException('Alert not found.');
        }
        return $this->ok([
            'alert' => AlertPresenter::staff($alert),
            'events' => array_map(static fn (array $row): array => AlertPresenter::event($row), $this->events->forAlert((string) $alert['id'])),
        ]);
    }

    public function acknowledge(Request $request): Response
    {
        $user = $this->user($request);
        $alert = $this->alerts->findDetailed((string) $request->param('id'));
        if ($alert === null || !AlertWorkflow::mayAcknowledge($user, $alert)) {
            throw new NotFoundException('Alert not found.');
        }
        $updated = $this->service->acknowledge($user, $alert);
        $this->audit->log('alert.acknowledged', $request, ['entity_type' => 'critical_alert', 'entity_id' => $updated['id']]);
        return $this->ok(['alert_id' => $updated['id'], 'status' => $updated['status'], 'acknowledged_at' => Model::iso($updated['acknowledged_at'])]);
    }

    public function resolve(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, ['note' => 'required|text|min:3|max:500']);
        $alertId = (string) $request->param('id');
        if ($this->alerts->findDetailed($alertId) === null) {
            throw new NotFoundException('Alert not found.');
        }
        $updated = $this->service->resolve($user, $alertId, $data['note']);
        $this->audit->log('alert.resolved', $request, ['entity_type' => 'critical_alert', 'entity_id' => $alertId]);
        return $this->ok(['alert' => AlertPresenter::staff($updated)]);
    }
}
