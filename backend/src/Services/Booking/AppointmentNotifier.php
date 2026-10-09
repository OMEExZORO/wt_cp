<?php

declare(strict_types=1);

namespace App\Services\Booking;

use App\Core\Config;
use App\Services\Clock;
use App\Services\Mail\MailService;

final class AppointmentNotifier
{
    public function __construct(
        private readonly MailService $mail,
        private readonly Config $config,
        private readonly Clock $clock
    ) {
    }

    public function confirmed(array $row): bool
    {
        return $this->send($row, 'booking-confirmed');
    }

    public function rescheduled(array $row, array $previous): bool
    {
        $before = '';
        if (isset($previous['date'], $previous['start_time'])) {
            $before = SlotCapacity::at((string) $previous['date'], (string) $previous['start_time'])->format('l j F Y, g:i A');
        }
        return $this->send($row, 'booking-rescheduled', ['previous_when' => $before]);
    }

    public function cancelled(array $row): bool
    {
        return $this->send($row, 'booking-cancelled');
    }

    public function domain(): string
    {
        $host = parse_url((string) $this->config->get('url'), PHP_URL_HOST);
        return is_string($host) && $host !== '' ? $host : 'diagnocare.local';
    }

    public function portalUrl(array $row): string
    {
        return rtrim((string) $this->config->get('frontend_url'), '/') . '/portal/patient/appointments/' . $row['id'];
    }

    private function send(array $row, string $template, array $extra = []): bool
    {
        $email = trim((string) ($row['patient_email'] ?? ''));
        if ($email === '') {
            return false;
        }
        $now = $this->clock->now();
        $start = SlotCapacity::at((string) $row['slot_date'], (string) $row['start_time']);
        $vars = array_merge([
            'name' => (string) $row['patient_name'],
            'reference' => (string) $row['reference_code'],
            'scan_name' => (string) $row['scan_name'],
            'branch_name' => (string) $row['branch_name'],
            'location' => AppointmentPresenter::location($row),
            'when' => $start->format('l j F Y, g:i A'),
            'preparation' => trim((string) ($row['preparation_tips'] ?? '')),
            'link' => $this->portalUrl($row),
            'reason' => trim((string) ($row['cancellation_reason'] ?? '')),
        ], $extra);
        $attachments = [[
            'name' => IcsCalendar::filename((string) $row['reference_code']),
            'type' => 'text/calendar; charset=utf-8; method=' . ($row['status'] === 'cancelled' ? 'CANCEL' : 'PUBLISH'),
            'content' => AppointmentPresenter::ics($row, $now, $this->domain(), $this->portalUrl($row)),
        ]];
        return $this->mail->sendTemplate($email, (string) $row['patient_name'], $template, $vars, $attachments);
    }
}
