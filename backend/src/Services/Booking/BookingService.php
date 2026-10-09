<?php

declare(strict_types=1);

namespace App\Services\Booking;

use App\Exceptions\ConflictException;
use App\Exceptions\NotFoundException;
use App\Exceptions\SlotFullException;
use App\Exceptions\ValidationException;
use App\Models\Appointment;
use App\Models\AppointmentChecklistAnswer;
use App\Models\Slot;
use App\Services\Clock;
use PDOException;

final class BookingService
{
    public const TRANSITIONS = [
        'pending' => ['confirmed', 'checked_in', 'no_show'],
        'confirmed' => ['checked_in', 'no_show'],
        'checked_in' => ['in_progress', 'completed'],
        'in_progress' => ['completed'],
    ];

    public function __construct(
        private readonly Slot $slots,
        private readonly Appointment $appointments,
        private readonly AppointmentChecklistAnswer $answers,
        private readonly Clock $clock
    ) {
    }

    public function book(string $patientId, array $scanType, string $slotId, array $answers, ?string $notes, string $urgency, ?string $bookedByUserId): string
    {
        try {
            return $this->appointments->transaction(function () use ($patientId, $scanType, $slotId, $answers, $notes, $urgency, $bookedByUserId): string {
                $slot = $this->slots->lockForUpdate($slotId);
                if ($slot === null) {
                    throw ValidationException::withField('slot_id', 'This time slot does not exist.');
                }
                if ($this->appointments->hasActiveInSlot($patientId, $slotId)) {
                    throw new ConflictException('You already have a booking in this time slot.', ['slot_id' => 'You already have a booking in this time slot.']);
                }
                $this->assertBookable($slot, (string) $scanType['modality']);
                $appointment = $this->appointments->create([
                    'reference_code' => $this->newReference(),
                    'patient_id' => $patientId,
                    'slot_id' => $slotId,
                    'branch_id' => $slot['branch_id'],
                    'scan_type_id' => $scanType['id'],
                    'booked_by_user_id' => $bookedByUserId,
                    'status' => 'confirmed',
                    'urgency' => $urgency,
                    'patient_notes' => $notes,
                    'consent_given_at' => $this->clock->now()->format(\DateTimeInterface::ATOM),
                ]);
                $this->answers->insertMany((string) $appointment['id'], $answers);
                $this->slots->incrementBooked($slotId);
                return (string) $appointment['id'];
            });
        } catch (SlotFullException $e) {
            throw $e->withSuggestion($this->suggestionFor($e->slot()));
        } catch (PDOException $e) {
            throw $this->translate($e, $slotId);
        }
    }

    public function reschedule(string $appointmentId, string $newSlotId, bool $byPatient): array
    {
        try {
            return $this->appointments->transaction(function () use ($appointmentId, $newSlotId, $byPatient): array {
                $appointment = $this->appointments->lockForUpdate($appointmentId);
                if ($appointment === null) {
                    throw new NotFoundException('Appointment not found.');
                }
                if (!in_array($appointment['status'], Appointment::ACTIVE_STATUSES, true)) {
                    throw new ConflictException('Only upcoming appointments can be rescheduled.');
                }
                if ($byPatient && SlotCapacity::hasStarted($appointment, $this->clock->now())) {
                    throw new ConflictException('This appointment has already started and cannot be rescheduled online.');
                }
                $oldSlotId = (string) $appointment['slot_id'];
                if ($oldSlotId === $newSlotId) {
                    throw ValidationException::withField('slot_id', 'Choose a different time from your current booking.');
                }
                $locked = $this->slots->lockPair($oldSlotId, $newSlotId);
                $newSlot = $locked[$newSlotId] ?? null;
                if ($newSlot === null) {
                    throw ValidationException::withField('slot_id', 'This time slot does not exist.');
                }
                $this->assertBookable($newSlot, (string) $appointment['modality']);
                if ($this->appointments->hasActiveInSlot((string) $appointment['patient_id'], $newSlotId, $appointmentId)) {
                    throw new ConflictException('You already have a booking in this time slot.', ['slot_id' => 'You already have a booking in this time slot.']);
                }
                $this->slots->releaseBooked($oldSlotId);
                $this->slots->incrementBooked($newSlotId);
                $this->appointments->moveToSlot($appointmentId, $newSlotId, (string) $newSlot['branch_id']);
                return [
                    'from' => ['slot_id' => $oldSlotId, 'branch_id' => $appointment['branch_id'], 'date' => $appointment['slot_date'], 'start_time' => substr((string) $appointment['start_time'], 0, 5)],
                    'to' => ['slot_id' => $newSlotId, 'branch_id' => $newSlot['branch_id'], 'date' => $newSlot['slot_date'], 'start_time' => substr((string) $newSlot['start_time'], 0, 5)],
                ];
            });
        } catch (SlotFullException $e) {
            throw $e->withSuggestion($this->suggestionFor($e->slot()));
        } catch (PDOException $e) {
            throw $this->translate($e, $newSlotId);
        }
    }

    public function cancel(string $appointmentId, ?string $reason, bool $byPatient): void
    {
        $this->appointments->transaction(function () use ($appointmentId, $reason, $byPatient): void {
            $appointment = $this->appointments->lockForUpdate($appointmentId);
            if ($appointment === null) {
                throw new NotFoundException('Appointment not found.');
            }
            if (!in_array($appointment['status'], Appointment::ACTIVE_STATUSES, true)) {
                throw new ConflictException('This appointment can no longer be cancelled.');
            }
            if ($byPatient && SlotCapacity::hasStarted($appointment, $this->clock->now())) {
                throw new ConflictException('This appointment has already started and cannot be cancelled online. Please contact the centre.');
            }
            $this->slots->lockForUpdate((string) $appointment['slot_id']);
            $this->slots->releaseBooked((string) $appointment['slot_id']);
            $this->appointments->markCancelled($appointmentId, $reason);
        });
    }

    public function changeStatus(string $appointmentId, ?string $status, ?string $urgency): array
    {
        return $this->appointments->transaction(function () use ($appointmentId, $status, $urgency): array {
            $appointment = $this->appointments->lockForUpdate($appointmentId);
            if ($appointment === null) {
                throw new NotFoundException('Appointment not found.');
            }
            $current = (string) $appointment['status'];
            if ($status !== null && $status !== $current) {
                self::assertTransition($current, $status, $appointment, $this->clock->now());
            }
            if ($urgency !== null && in_array($current, ['cancelled', 'no_show', 'completed'], true)) {
                throw new ConflictException('Urgency can only be changed on active appointments.');
            }
            $newStatus = $status !== null && $status !== $current ? $status : null;
            $newUrgency = $urgency !== null && $urgency !== $appointment['urgency'] ? $urgency : null;
            $this->appointments->applyStatus($appointmentId, $newStatus, $newUrgency);
            return [
                'status' => ['from' => $current, 'to' => $newStatus ?? $current],
                'urgency' => ['from' => $appointment['urgency'], 'to' => $newUrgency ?? $appointment['urgency']],
            ];
        });
    }

    public static function assertTransition(string $from, string $to, array $slot, \DateTimeImmutable $now): void
    {
        if (!in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new ConflictException(sprintf('An appointment that is %s cannot be marked %s.', str_replace('_', ' ', $from), str_replace('_', ' ', $to)), ['status' => 'This status change is not allowed.']);
        }
        if ($to === 'checked_in' && (string) $slot['slot_date'] > $now->format('Y-m-d')) {
            throw new ConflictException('Patients can be checked in only on the day of the appointment.', ['status' => 'Check-in opens on the appointment day.']);
        }
        if ($to === 'no_show' && !SlotCapacity::hasStarted($slot, $now)) {
            throw new ConflictException('An appointment can be marked as a no-show only after its start time.', ['status' => 'The appointment has not started yet.']);
        }
    }

    public function suggestionFor(?array $slot): ?array
    {
        if ($slot === null) {
            return null;
        }
        $fromDate = (string) $slot['slot_date'];
        $fromTime = substr((string) $slot['start_time'], 0, 5);
        $other = $this->slots->nextAvailable((string) $slot['modality'], $fromDate, $this->clock->today(), $this->clock->time(), (string) $slot['branch_id'], null, $fromTime);
        if ($other !== null) {
            return self::presentSuggestion($other, 'other_branch');
        }
        $same = $this->slots->nextAvailable((string) $slot['modality'], $fromDate, $this->clock->today(), $this->clock->time(), null, (string) $slot['branch_id'], $fromTime);
        return $same === null ? null : self::presentSuggestion($same, 'same_branch');
    }

    public function nextAvailable(string $modality, string $fromDate, ?string $excludeBranchId): ?array
    {
        $row = $this->slots->nextAvailable($modality, $fromDate, $this->clock->today(), $this->clock->time(), $excludeBranchId);
        return $row === null ? null : self::presentSuggestion($row, $excludeBranchId !== null ? 'other_branch' : 'any_branch');
    }

    public static function presentSuggestion(array $slot, string $kind): array
    {
        return [
            'kind' => $kind,
            'branch' => ['id' => $slot['branch_id'], 'name' => $slot['branch_name'], 'slug' => $slot['branch_slug']],
            'slot' => SlotPresenter::present($slot),
        ];
    }

    private function assertBookable(array $slot, string $modality): void
    {
        $status = SlotCapacity::status($slot, $this->clock->now(), $modality);
        if ($status === SlotCapacity::FULL) {
            throw new SlotFullException(SlotCapacity::message($status), null, $slot);
        }
        if ($status !== SlotCapacity::OK) {
            throw ValidationException::withField('slot_id', SlotCapacity::message($status));
        }
    }

    private function newReference(): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $code = ReferenceCode::generate($this->clock->now());
            if (!$this->appointments->referenceExists($code)) {
                return $code;
            }
        }
        throw new \RuntimeException('Could not generate a unique booking reference');
    }

    private function translate(PDOException $e, string $slotId): \Throwable
    {
        $state = (string) ($e->errorInfo[0] ?? $e->getCode());
        if ($state === '23505') {
            return new ConflictException('You already have a booking in this time slot.', ['slot_id' => 'You already have a booking in this time slot.']);
        }
        if ($state === '23514' && str_contains($e->getMessage(), 'slots_booked_count_check')) {
            $slot = $this->slots->findWithBranch($slotId);
            return new SlotFullException(SlotCapacity::message(SlotCapacity::FULL), $this->suggestionFor($slot), $slot);
        }
        return $e;
    }
}
