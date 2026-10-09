<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\NotFoundException;
use App\Exceptions\SlotFullException;
use App\Exceptions\ValidationException;
use App\Models\Appointment;
use App\Models\AppointmentChecklistAnswer;
use App\Models\ChecklistItem;
use App\Models\Model;
use App\Models\Patient;
use App\Models\ScanType;
use App\Services\AuditLogger;
use App\Services\Booking\AppointmentNotifier;
use App\Services\Booking\AppointmentPresenter;
use App\Services\Booking\BookingService;
use App\Services\Booking\ChecklistEvaluator;
use App\Services\Booking\IcsCalendar;
use App\Services\Clock;

final class AppointmentController extends Controller
{
    public const STAFF_ROLES = ['receptionist', 'doctor', 'admin'];
    public const BOOKING_STAFF_ROLES = ['receptionist', 'admin'];

    public function __construct(
        private readonly Config $config,
        private readonly Appointment $appointments,
        private readonly AppointmentChecklistAnswer $answers,
        private readonly ChecklistItem $checklist,
        private readonly ScanType $scanTypes,
        private readonly Patient $patients,
        private readonly BookingService $booking,
        private readonly AppointmentNotifier $notifier,
        private readonly AuditLogger $audit,
        private readonly Clock $clock
    ) {
    }

    public function index(Request $request): Response
    {
        $user = $this->user($request);
        $now = $this->clock->now();
        if ($user['role'] === 'patient') {
            $filters = $this->validate($request, ['scope' => 'nullable|in:upcoming,past,all']);
            $patient = $this->patients->findByUserId((string) $user['id']);
            $rows = $patient === null ? [] : $this->appointments->listForPatient((string) $patient['id'], $filters['scope'] ?? 'all', $this->clock->today(), $this->clock->time());
            $items = array_map(static fn (array $row): array => AppointmentPresenter::present($row, $now, false), $rows);
            return $this->ok(['appointments' => $items], 200, ['page' => 1, 'per_page' => count($items), 'total' => count($items)]);
        }

        $filters = $this->validate($request, [
            'scope' => 'nullable|in:upcoming,past,all',
            'date' => 'nullable|date',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'branch_id' => 'nullable|uuid',
            'status' => 'nullable|in:' . implode(',', Appointment::STATUSES),
            'urgency' => 'nullable|in:' . implode(',', Appointment::URGENCIES),
            'q' => 'nullable|string|max:80',
            'page' => 'nullable|integer|min:1|max:1000',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 50);
        $rows = $this->appointments->listForStaff($filters, $this->clock->today(), $this->clock->time(), $perPage, ($page - 1) * $perPage);
        $total = $this->appointments->countForStaff($filters, $this->clock->today(), $this->clock->time());
        $attention = $this->answers->attentionFor(array_map(static fn (array $row): string => (string) $row['id'], $rows));
        $items = array_map(
            static fn (array $row): array => AppointmentPresenter::present($row, $now, true, [], $attention[(string) $row['id']] ?? []),
            $rows
        );
        return $this->ok(['appointments' => $items], 200, ['page' => $page, 'per_page' => $perPage, 'total' => $total]);
    }

    public function show(Request $request): Response
    {
        $user = $this->user($request);
        $row = $this->authorizedRow($request, $user);
        return $this->ok(['appointment' => $this->present($row, $user)]);
    }

    public function store(Request $request): Response
    {
        $user = $this->user($request);
        $isStaff = in_array($user['role'], self::BOOKING_STAFF_ROLES, true);
        $rules = [
            'scan_type_id' => 'required|uuid',
            'slot_id' => 'required|uuid',
            'consent' => 'required|accepted',
            'patient_notes' => 'nullable|text|max:1000',
        ];
        if ($isStaff) {
            $rules += [
                'patient_id' => 'nullable|uuid',
                'patient_full_name' => 'nullable|name|min:2|max:120',
                'patient_phone' => 'nullable|phone',
                'urgency' => 'nullable|in:' . implode(',', Appointment::URGENCIES),
            ];
        }

        $errors = [];
        $data = [];
        try {
            $data = $this->validate($request, $rules);
        } catch (ValidationException $e) {
            $errors = $e->fields();
            if (!isset($errors['scan_type_id'])) {
                $data = $this->validate($request, ['scan_type_id' => 'required|uuid']);
            }
        }

        $rawAnswers = $request->body()['answers'] ?? [];
        if (!is_array($rawAnswers) || ($rawAnswers !== [] && array_is_list($rawAnswers))) {
            $errors['answers'] = 'Answers must be sent as an object keyed by question id.';
            $rawAnswers = [];
        }

        $scan = null;
        $items = [];
        if (isset($data['scan_type_id'])) {
            $scan = $this->scanTypes->findForBooking($data['scan_type_id']);
            if ($scan === null) {
                $errors['scan_type_id'] = 'Choose a scan from the list.';
            } elseif (!$isStaff && !Model::flag($scan['is_bookable_online'])) {
                $errors['scan_type_id'] = 'This scan cannot be booked online. Please contact the centre.';
            } else {
                $items = $this->checklist->forScanType((string) $scan['id'], (string) $scan['modality']);
            }
        }

        $answers = [];
        try {
            $answers = $this->validate($request, ChecklistEvaluator::rules($items), [], $rawAnswers);
        } catch (ValidationException $e) {
            $errors += ChecklistEvaluator::prefixErrors($e->fields());
        }

        if ($isStaff && empty($data['patient_id']) && (empty($data['patient_full_name']) || empty($data['patient_phone'])) && !isset($errors['patient_id'])) {
            $errors['patient_full_name'] ??= 'Enter the patient\'s name and mobile number, or choose an existing patient.';
            if (empty($data['patient_phone'])) {
                $errors['patient_phone'] ??= 'Enter the patient\'s mobile number.';
            }
        }

        if ($errors !== [] || $scan === null) {
            throw new ValidationException($errors === [] ? ['scan_type_id' => 'Choose a scan from the list.'] : $errors);
        }

        $patient = $isStaff ? $this->walkInPatient($data, $user, $request) : $this->ownPatient($user);
        $evaluated = ChecklistEvaluator::evaluate($items, $answers);
        $urgency = $isStaff ? ($data['urgency'] ?? 'Routine') : 'Routine';

        try {
            $id = $this->booking->book(
                (string) $patient['id'],
                $scan,
                $data['slot_id'],
                $evaluated,
                $data['patient_notes'] ?? null,
                $urgency,
                (string) $user['id']
            );
        } catch (SlotFullException $e) {
            $this->audit->log('booking.slot_full', $request, [
                'entity_type' => 'slot',
                'entity_id' => $data['slot_id'],
                'metadata' => ['suggestion_slot_id' => $e->suggestion()['slot']['id'] ?? null],
            ]);
            throw $e;
        }

        $row = $this->appointments->findDetailed($id) ?? throw new NotFoundException('Appointment not found.');
        $flagged = array_values(array_map(
            static fn (array $answer): string => $answer['code'],
            array_filter($evaluated, static fn (array $answer): bool => $answer['needs_attention'])
        ));
        $this->audit->log('booking.created', $request, [
            'entity_type' => 'appointment',
            'entity_id' => $id,
            'metadata' => [
                'reference' => $row['reference_code'],
                'slot_id' => $row['slot_id'],
                'branch_id' => $row['branch_id'],
                'scan_type_id' => $row['scan_type_id'],
                'on_behalf' => $isStaff,
                'attention_items' => $flagged,
            ],
        ]);
        if ($flagged !== []) {
            $this->audit->log('booking.attention_flagged', $request, [
                'entity_type' => 'appointment',
                'entity_id' => $id,
                'metadata' => ['items' => $flagged],
            ]);
        }
        $emailSent = $this->notifier->confirmed($row);
        return $this->created(['appointment' => $this->present($row, $user), 'email_sent' => $emailSent]);
    }

    public function reschedule(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, ['slot_id' => 'required|uuid']);
        $row = $this->authorizedRow($request, $user, self::BOOKING_STAFF_ROLES);
        try {
            $change = $this->booking->reschedule((string) $row['id'], $data['slot_id'], $user['role'] === 'patient');
        } catch (SlotFullException $e) {
            $this->audit->log('booking.slot_full', $request, ['entity_type' => 'slot', 'entity_id' => $data['slot_id']]);
            throw $e;
        }
        $updated = $this->appointments->findDetailed((string) $row['id']) ?? throw new NotFoundException('Appointment not found.');
        $this->audit->log('booking.rescheduled', $request, [
            'entity_type' => 'appointment',
            'entity_id' => $row['id'],
            'metadata' => ['reference' => $row['reference_code'], 'from' => $change['from'], 'to' => $change['to']],
        ]);
        $emailSent = $this->notifier->rescheduled($updated, $change['from']);
        return $this->ok(['appointment' => $this->present($updated, $user), 'email_sent' => $emailSent]);
    }

    public function cancel(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, ['reason' => 'nullable|text|max:500']);
        $row = $this->authorizedRow($request, $user, self::BOOKING_STAFF_ROLES);
        $this->booking->cancel((string) $row['id'], $data['reason'] ?? null, $user['role'] === 'patient');
        $updated = $this->appointments->findDetailed((string) $row['id']) ?? throw new NotFoundException('Appointment not found.');
        $this->audit->log('booking.cancelled', $request, [
            'entity_type' => 'appointment',
            'entity_id' => $row['id'],
            'metadata' => ['reference' => $row['reference_code'], 'slot_id' => $row['slot_id'], 'by' => $user['role']],
        ]);
        $emailSent = $this->notifier->cancelled($updated);
        return $this->ok(['appointment' => $this->present($updated, $user), 'email_sent' => $emailSent]);
    }

    public function updateStatus(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, [
            'status' => 'nullable|in:checked_in,in_progress,completed,no_show',
            'urgency' => 'nullable|in:' . implode(',', Appointment::URGENCIES),
        ]);
        if (($data['status'] ?? null) === null && ($data['urgency'] ?? null) === null) {
            throw new ValidationException(['status' => 'Choose a new status or urgency.']);
        }
        $row = $this->authorizedRow($request, $user, self::STAFF_ROLES);
        $change = $this->booking->changeStatus((string) $row['id'], $data['status'] ?? null, $data['urgency'] ?? null);
        if ($change['status']['from'] !== $change['status']['to']) {
            $this->audit->log('booking.status_changed', $request, [
                'entity_type' => 'appointment',
                'entity_id' => $row['id'],
                'metadata' => ['reference' => $row['reference_code']] + $change['status'],
            ]);
        }
        if ($change['urgency']['from'] !== $change['urgency']['to']) {
            $this->audit->log('booking.urgency_changed', $request, [
                'entity_type' => 'appointment',
                'entity_id' => $row['id'],
                'metadata' => ['reference' => $row['reference_code']] + $change['urgency'],
            ]);
        }
        $updated = $this->appointments->findDetailed((string) $row['id']) ?? throw new NotFoundException('Appointment not found.');
        return $this->ok(['appointment' => $this->present($updated, $user)]);
    }

    public function ics(Request $request): Response
    {
        $user = $this->user($request);
        $row = $this->authorizedRow($request, $user);
        $body = AppointmentPresenter::ics($row, $this->clock->now(), $this->notifier->domain(), $this->notifier->portalUrl($row));
        return new Response($body, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . IcsCalendar::filename((string) $row['reference_code']) . '"',
        ]);
    }

    private function authorizedRow(Request $request, array $user, array $staffRoles = self::STAFF_ROLES): array
    {
        $row = $this->appointments->findDetailed((string) $request->param('id'));
        if ($row === null) {
            throw new NotFoundException('Appointment not found.');
        }
        if ($user['role'] === 'patient' && (string) $row['patient_user_id'] === (string) $user['id']) {
            return $row;
        }
        if (in_array($user['role'], $staffRoles, true)) {
            return $row;
        }
        throw new NotFoundException('Appointment not found.');
    }

    private function present(array $row, array $user): array
    {
        $isStaff = in_array($user['role'], self::STAFF_ROLES, true);
        $checklist = $this->answers->forAppointment((string) $row['id']);
        $attention = [];
        if ($isStaff) {
            foreach ($checklist as $answer) {
                if (Model::flag($answer['needs_attention'])) {
                    $attention[] = ['code' => $answer['code'], 'question' => $answer['question'], 'answer' => $answer['answer']];
                }
            }
        }
        return AppointmentPresenter::present($row, $this->clock->now(), $isStaff, $checklist, $attention);
    }

    private function ownPatient(array $user): array
    {
        $patient = $this->patients->findByUserId((string) $user['id']);
        if ($patient !== null) {
            return $patient;
        }
        return $this->patients->create([
            'user_id' => $user['id'],
            'full_name' => $user['full_name'],
            'phone' => $user['phone'] ?? null,
            'email' => $user['email'],
            'consent_given_at' => $this->clock->now()->format(\DateTimeInterface::ATOM),
            'consent_version' => (string) $this->config->get('auth.consent_version'),
        ]);
    }

    private function walkInPatient(array $data, array $user, Request $request): array
    {
        if (!empty($data['patient_id'])) {
            $patient = $this->patients->find($data['patient_id']);
            if ($patient === null) {
                throw ValidationException::withField('patient_id', 'This patient record does not exist.');
            }
            return $patient;
        }
        $existing = $this->patients->findWalkIn((string) $data['patient_full_name'], (string) $data['patient_phone']);
        if ($existing !== null) {
            return $existing;
        }
        $created = $this->patients->create([
            'full_name' => $data['patient_full_name'],
            'phone' => $data['patient_phone'],
            'consent_given_at' => $this->clock->now()->format(\DateTimeInterface::ATOM),
            'consent_version' => (string) $this->config->get('auth.consent_version'),
            'created_by_user_id' => $user['id'],
        ]);
        $this->audit->log('patient.created_walk_in', $request, [
            'entity_type' => 'patient',
            'entity_id' => $created['id'] ?? null,
        ]);
        return $created;
    }
}
