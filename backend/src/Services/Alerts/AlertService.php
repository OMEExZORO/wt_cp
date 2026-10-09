<?php

declare(strict_types=1);

namespace App\Services\Alerts;

use App\Core\Config;
use App\Exceptions\ConflictException;
use App\Exceptions\NotFoundException;
use App\Models\AlertEvent;
use App\Models\CriticalAlert;
use App\Services\Mail\MailService;

final class AlertService
{
    public function __construct(
        private readonly CriticalAlert $alerts,
        private readonly AlertEvent $events,
        private readonly MailService $mail,
        private readonly SmsGateway $sms,
        private readonly NoteProtector $notes,
        private readonly Config $config,
        private readonly int $windowMinutes
    ) {
    }

    public function noteStorageAvailable(): bool
    {
        return $this->notes->available();
    }

    public function raise(array $user, string $reportId, ?string $note): array
    {
        $context = $this->alerts->reportContext($reportId);
        if ($context === null || $context['deleted_at'] !== null) {
            throw new NotFoundException('Report not found.');
        }
        $stored = $note !== null && $note !== '' && $this->notes->available() ? $this->notes->protect($note) : null;

        $alertId = $this->alerts->transaction(function () use ($user, $reportId, $context, $stored): string {
            if ($this->alerts->lockReport($reportId) === null) {
                throw new NotFoundException('Report not found.');
            }
            if ($this->alerts->hasActiveForReport($reportId)) {
                throw new ConflictException('This report already has an active critical alert.');
            }
            $alert = $this->alerts->create([
                'report_id' => $reportId,
                'patient_id' => $context['patient_id'],
                'referrer_id' => $context['referrer_id'],
                'raised_by_user_id' => $user['id'],
                'finding_summary_encrypted' => $stored,
                'status' => 'open',
            ]);
            $this->alerts->markReportCritical($reportId);
            $this->events->record((string) $alert['id'], 'raised', null, 'open', (string) $user['id'], null, [
                'report_id' => $reportId,
                'has_clinical_note' => $stored !== null,
            ]);
            return (string) $alert['id'];
        });

        $sent = $this->notify($alertId, $context);
        $this->alerts->transaction(function () use ($alertId, $sent): void {
            $this->alerts->applyNotified($alertId, $sent, $this->windowMinutes);
            $this->events->record($alertId, 'notified', 'open', 'notified', null, 'in_app', ['surface' => 'portal_banner']);
        });

        return $this->alerts->findDetailed($alertId) ?? [];
    }

    public function acknowledge(array $user, array $alert): array
    {
        $alertId = (string) $alert['id'];
        $this->alerts->transaction(function () use ($user, $alertId): void {
            $locked = $this->alerts->lockForUpdate($alertId);
            if ($locked === null) {
                throw new NotFoundException('Alert not found.');
            }
            AlertWorkflow::assertTransition((string) $locked['status'], 'acknowledged');
            $this->alerts->applyAcknowledged($alertId, (string) $user['id']);
            $this->events->record($alertId, 'acknowledged', (string) $locked['status'], 'acknowledged', (string) $user['id'], 'in_app', [
                'by_role' => $user['role'],
            ]);
        });
        return $this->alerts->findDetailed($alertId) ?? [];
    }

    public function resolve(array $user, string $alertId, string $note): array
    {
        $this->alerts->transaction(function () use ($user, $alertId, $note): void {
            $locked = $this->alerts->lockForUpdate($alertId);
            if ($locked === null) {
                throw new NotFoundException('Alert not found.');
            }
            AlertWorkflow::assertTransition((string) $locked['status'], 'resolved');
            $this->events->record($alertId, 'phone_contacted', (string) $locked['status'], (string) $locked['status'], (string) $user['id'], 'phone', ['note' => $note]);
            $this->alerts->applyResolved($alertId, (string) $user['id'], $note);
            $this->events->record($alertId, 'resolved', (string) $locked['status'], 'resolved', (string) $user['id'], null, []);
        });
        return $this->alerts->findDetailed($alertId) ?? [];
    }

    private function notify(string $alertId, array $context): int
    {
        $portal = rtrim((string) $this->config->get('frontend_url'), '/') . '/portal';
        $targets = [
            ['recipient' => 'patient', 'to' => (string) ($context['patient_email'] ?? ''), 'name' => (string) $context['patient_name'],
                'intro' => sprintf('A finding in your %s report needs urgent attention.', $context['scan_name'])],
            ['recipient' => 'referrer', 'to' => (string) ($context['referrer_email'] ?? ''), 'name' => (string) ($context['referrer_name'] ?? ''),
                'intro' => sprintf('A finding in the %s report of your referred patient needs urgent attention.', $context['scan_name'])],
        ];
        $sent = 0;
        foreach ($targets as $target) {
            if ($target['to'] === '') {
                continue;
            }
            $ok = $this->mail->sendTemplate($target['to'], $target['name'], 'critical-alert', [
                'name' => $target['name'],
                'intro' => $target['intro'],
                'scan_name' => (string) $context['scan_name'],
                'reference' => (string) $context['reference_code'],
                'link' => $portal,
            ]);
            if ($ok) {
                $sent++;
                $this->events->record($alertId, 'notified', 'open', 'open', null, 'email', ['recipient' => $target['recipient']]);
            } else {
                $this->events->record($alertId, 'delivery_failed', 'open', 'open', null, 'email', ['recipient' => $target['recipient']]);
            }
        }
        $phone = trim((string) ($context['patient_phone'] ?? ''));
        if ($phone !== '') {
            $delivered = $this->sms->send($phone, 'Meghnad Diagnostic Centre: an important finding in your report needs attention. Please sign in to your portal.');
            $this->events->record($alertId, $delivered ? 'notified' : 'delivery_failed', 'open', 'open', null, 'sms_stub', ['recipient' => 'patient']);
        }
        return $sent;
    }
}
