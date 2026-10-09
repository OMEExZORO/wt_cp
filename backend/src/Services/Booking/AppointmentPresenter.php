<?php

declare(strict_types=1);

namespace App\Services\Booking;

use App\Models\Appointment;
use App\Models\Model;
use DateTimeImmutable;

final class AppointmentPresenter
{
    public static function present(array $row, DateTimeImmutable $now, bool $forStaff, array $checklist = [], array $attention = []): array
    {
        $start = SlotCapacity::at((string) $row['slot_date'], (string) $row['start_time']);
        $end = SlotCapacity::at((string) $row['slot_date'], (string) $row['end_time']);
        $status = (string) $row['status'];
        $active = in_array($status, Appointment::ACTIVE_STATUSES, true);
        $started = $start <= $now;
        $location = self::location($row);

        $data = [
            'id' => $row['id'],
            'reference_code' => $row['reference_code'],
            'status' => $status,
            'urgency' => $row['urgency'],
            'starts_at' => $start->format(\DateTimeInterface::ATOM),
            'ends_at' => $end->format(\DateTimeInterface::ATOM),
            'slot' => [
                'id' => $row['slot_id'],
                'date' => (string) $row['slot_date'],
                'start_time' => substr((string) $row['start_time'], 0, 5),
                'end_time' => substr((string) $row['end_time'], 0, 5),
            ],
            'branch' => [
                'id' => $row['branch_id'],
                'name' => $row['branch_name'],
                'slug' => $row['branch_slug'],
                'address' => $location,
                'phone' => $row['branch_phone'] ?? null,
                'maps_url' => $row['branch_maps_url'] ?? null,
            ],
            'scan_type' => [
                'id' => $row['scan_type_id'],
                'name' => $row['scan_name'],
                'slug' => $row['scan_slug'],
                'modality' => $row['modality'],
                'preparation_tips' => $row['preparation_tips'],
            ],
            'patient' => [
                'id' => $row['patient_id'],
                'full_name' => $row['patient_name'],
            ],
            'patient_notes' => $row['patient_notes'],
            'needs_attention' => (int) ($row['attention_count'] ?? 0) > 0,
            'attention_count' => (int) ($row['attention_count'] ?? 0),
            'booked_by_staff' => in_array($row['booked_by_role'] ?? null, ['receptionist', 'admin', 'doctor'], true),
            'created_at' => Model::iso($row['created_at']),
            'rescheduled_at' => Model::iso($row['rescheduled_at'] ?? null),
            'checked_in_at' => Model::iso($row['checked_in_at']),
            'completed_at' => Model::iso($row['completed_at']),
            'cancelled_at' => Model::iso($row['cancelled_at']),
            'cancellation_reason' => $row['cancellation_reason'],
            'can_cancel' => $active && ($forStaff || !$started),
            'can_reschedule' => $active && ($forStaff || !$started),
            'calendar' => [
                'ics_path' => '/appointments/' . $row['id'] . '/ics',
                'google_url' => $status === 'cancelled' ? null : GoogleCalendarLink::build(
                    self::title($row),
                    $start,
                    $end,
                    self::calendarDetails($row),
                    $location
                ),
            ],
        ];

        if ($forStaff) {
            $data['patient']['phone'] = $row['patient_phone'];
            $data['patient']['email'] = $row['patient_email'];
            $data['attention'] = $attention;
        }
        if ($checklist !== []) {
            $data['checklist'] = array_map(static fn (array $answer): array => [
                'checklist_item_id' => $answer['checklist_item_id'],
                'code' => $answer['code'],
                'question' => $answer['question'],
                'answer' => $answer['answer'],
                'needs_attention' => Model::flag($answer['needs_attention']),
            ], $checklist);
        }
        return $data;
    }

    public static function title(array $row): string
    {
        return sprintf('%s at %s', (string) $row['scan_name'], (string) $row['branch_name']);
    }

    public static function location(array $row): string
    {
        $parts = [(string) $row['branch_name']];
        $address = trim((string) ($row['branch_address_line'] ?? ''));
        if ($address !== '' && !str_starts_with($address, 'TODO')) {
            $parts[] = $address;
            foreach (['branch_landmark', 'branch_area'] as $key) {
                $value = trim((string) ($row[$key] ?? ''));
                if ($value !== '' && !str_starts_with($value, 'TODO')) {
                    $parts[] = $value;
                }
            }
        }
        $city = trim((string) ($row['branch_city'] ?? ''));
        $postal = trim((string) ($row['branch_postal_code'] ?? ''));
        if ($city !== '') {
            $parts[] = trim($city . ' ' . $postal);
        }
        return implode(', ', $parts);
    }

    public static function calendarDetails(array $row): string
    {
        $lines = [
            'Booking reference: ' . $row['reference_code'],
            'Scan: ' . $row['scan_name'],
        ];
        $tips = trim((string) ($row['preparation_tips'] ?? ''));
        if ($tips !== '') {
            $lines[] = 'Preparation: ' . $tips;
        }
        $lines[] = 'Please bring your doctor\'s referral, previous reports and a photo ID.';
        $lines[] = 'This is not for emergencies. In an emergency call 112.';
        return implode("\n", $lines);
    }

    public static function ics(array $row, DateTimeImmutable $now, string $domain, string $portalUrl = ''): string
    {
        return IcsCalendar::event([
            'uid' => $row['id'] . '@' . $domain,
            'sequence' => (int) ($row['calendar_sequence'] ?? 0),
            'dtstamp' => $now,
            'start' => SlotCapacity::at((string) $row['slot_date'], (string) $row['start_time']),
            'end' => SlotCapacity::at((string) $row['slot_date'], (string) $row['end_time']),
            'summary' => self::title($row),
            'description' => self::calendarDetails($row),
            'location' => self::location($row),
            'url' => $portalUrl,
            'status' => $row['status'] === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
        ]);
    }
}
