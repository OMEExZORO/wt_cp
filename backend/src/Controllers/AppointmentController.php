<?php

declare(strict_types=1);

namespace DiagnoCare\Controllers;

use DiagnoCare\Core\Auth;
use DiagnoCare\Core\Database;
use DiagnoCare\Core\HttpException;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;
use DiagnoCare\Core\Validator;
use PDOException;

final class AppointmentController
{
    private const BOOKING_WINDOW_DAYS = 60;
    private const SUGGESTION_SEARCH_DAYS = 30;
    private const STAFF_STATUSES = ['booked', 'confirmed', 'completed', 'cancelled', 'no_show'];

    public function availability(Request $request): never
    {
        Auth::require(Auth::PATIENT, Auth::RECEPTIONIST, Auth::DOCTOR);
        $data = Validator::validate($request->query(), [
            'branch_id' => 'required|id',
            'date' => 'required|date|not_past',
        ]);
        $this->assertWithinWindow($data['date']);
        $branch = $this->activeBranch($data['branch_id']);

        $slots = $this->slotsFor($branch['id'], $data['date']);
        $free = array_values(array_filter($slots, static fn (array $s) => $s['available']));
        $suggestion = $free === [] ? $this->suggestElsewhere($branch['id'], $data['date']) : null;

        Response::ok([
            'branch' => ['id' => $branch['id'], 'name' => $branch['name']],
            'date' => $data['date'],
            'slots' => $slots,
            'branch_full' => $free === [],
            'suggestion' => $suggestion,
        ]);
    }

    public function index(Request $request): never
    {
        $user = Auth::require();
        $filters = Validator::validate($request->query(), [
            'date' => 'nullable|date',
            'branch_id' => 'nullable|id',
            'status' => 'nullable|in:' . implode(',', self::STAFF_STATUSES),
            'scope' => 'nullable|in:upcoming,past,all',
        ]);

        $sql = 'SELECT a.id, a.appointment_date, a.start_time, s.end_time, a.status, a.notes, a.created_at,
                       a.patient_id, p.full_name AS patient_name, p.phone AS patient_phone,
                       a.branch_id, b.name AS branch_name,
                       a.scan_type_id, st.name AS scan_type_name, st.category AS scan_category,
                       a.referring_doctor_id, r.full_name AS referring_doctor_name
                FROM appointments a
                JOIN users p ON p.id = a.patient_id
                JOIN branches b ON b.id = a.branch_id
                JOIN scan_types st ON st.id = a.scan_type_id
                JOIN slots s ON s.id = a.slot_id
                LEFT JOIN users r ON r.id = a.referring_doctor_id
                WHERE 1 = 1';
        $params = [];

        switch ($user['role']) {
            case Auth::PATIENT:
                $sql .= ' AND a.patient_id = :uid';
                $params['uid'] = (int) $user['id'];
                break;
            case Auth::REFERRING_DOCTOR:
                $sql .= ' AND a.referring_doctor_id = :uid';
                $params['uid'] = (int) $user['id'];
                break;
        }

        if (!empty($filters['date'])) {
            $sql .= ' AND a.appointment_date = :date';
            $params['date'] = $filters['date'];
        }
        if (!empty($filters['branch_id'])) {
            $sql .= ' AND a.branch_id = :branch';
            $params['branch'] = $filters['branch_id'];
        }
        if (!empty($filters['status'])) {
            $sql .= ' AND a.status = :status';
            $params['status'] = $filters['status'];
        }
        $scope = $filters['scope'] ?? 'all';
        if ($scope === 'upcoming') {
            $sql .= ' AND a.appointment_date >= CURDATE()';
        } elseif ($scope === 'past') {
            $sql .= ' AND a.appointment_date < CURDATE()';
        }
        $sql .= $scope === 'upcoming'
            ? ' ORDER BY a.appointment_date, a.start_time LIMIT 500'
            : ' ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 500';

        Response::ok(Database::all($sql, $params));
    }

    public function show(Request $request): never
    {
        $user = Auth::require();
        $appointment = $this->findVisible($request->intParam('id'), $user);
        Response::ok($appointment);
    }

    public function store(Request $request): never
    {
        $user = Auth::require(Auth::PATIENT, Auth::RECEPTIONIST, Auth::DOCTOR);
        $data = Validator::validate($request->input(), [
            'branch_id' => 'required|id',
            'scan_type_id' => 'required|id',
            'slot_id' => 'required|id',
            'appointment_date' => 'required|date|not_past',
            'patient_id' => 'nullable|id',
            'referring_doctor_id' => 'nullable|id',
            'notes' => 'nullable|string|max:500',
        ]);
        $this->assertWithinWindow($data['appointment_date']);

        if ($user['role'] === Auth::PATIENT) {
            $patientId = (int) $user['id'];
        } else {
            if (empty($data['patient_id'])) {
                throw new HttpException(422, 'Please correct the highlighted fields.', ['patient_id' => 'Select the patient for this booking.']);
            }
            $patientId = $data['patient_id'];
            if (Database::one("SELECT 1 FROM users WHERE id = :id AND role = 'patient' AND is_active = 1", ['id' => $patientId]) === null) {
                throw new HttpException(422, 'Please correct the highlighted fields.', ['patient_id' => 'Patient not found.']);
            }
        }

        $branch = $this->activeBranch($data['branch_id']);
        if (Database::one('SELECT 1 FROM scan_types WHERE id = :id AND is_active = 1', ['id' => $data['scan_type_id']]) === null) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['scan_type_id' => 'Select a valid scan type.']);
        }
        if (!empty($data['referring_doctor_id'])
            && Database::one("SELECT 1 FROM users WHERE id = :id AND role = 'referring_doctor' AND is_active = 1", ['id' => $data['referring_doctor_id']]) === null) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['referring_doctor_id' => 'Select a valid referring doctor.']);
        }

        $slot = Database::one(
            'SELECT id, branch_id, day_of_week, start_time, end_time FROM slots WHERE id = :id AND is_active = 1',
            ['id' => $data['slot_id']]
        );
        $dayOfWeek = (int) date('w', strtotime($data['appointment_date']));
        if ($slot === null || (int) $slot['branch_id'] !== (int) $branch['id'] || (int) $slot['day_of_week'] !== $dayOfWeek) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['slot_id' => 'This slot is not offered at the selected branch on that day.']);
        }
        if ($data['appointment_date'] === date('Y-m-d') && $slot['start_time'] <= date('H:i:s')) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['slot_id' => 'This slot has already started. Please pick a later time.']);
        }

        try {
            $id = Database::insert(
                'INSERT INTO appointments
                    (patient_id, branch_id, scan_type_id, slot_id, appointment_date, start_time, referring_doctor_id, notes, created_by)
                 VALUES (:patient, :branch, :scan, :slot, :date, :start, :ref, :notes, :creator)',
                [
                    'patient' => $patientId,
                    'branch' => (int) $branch['id'],
                    'scan' => $data['scan_type_id'],
                    'slot' => (int) $slot['id'],
                    'date' => $data['appointment_date'],
                    'start' => $slot['start_time'],
                    'ref' => $data['referring_doctor_id'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'creator' => (int) $user['id'],
                ]
            );
        } catch (PDOException $e) {
            if (!Database::isDuplicate($e)) {
                throw $e;
            }
            if (str_contains($e->getMessage(), 'uq_patient_date_time')) {
                throw new HttpException(409, 'This patient already has an appointment at that date and time.', [], ['code' => 'patient_conflict']);
            }
            $nextHere = $this->nextFreeSlotAt((int) $branch['id'], $data['appointment_date']);
            throw new HttpException(409, 'Sorry, that slot was just booked by someone else.', [], [
                'code' => 'slot_taken',
                'next_same_branch' => $nextHere,
                'suggestion' => $nextHere === null ? $this->suggestElsewhere((int) $branch['id'], $data['appointment_date']) : null,
            ]);
        }

        Response::ok($this->findVisible($id, $user), 'Appointment booked successfully.', 201);
    }

    public function updateStatus(Request $request): never
    {
        $user = Auth::require(Auth::PATIENT, Auth::RECEPTIONIST, Auth::DOCTOR);
        $appointment = $this->findVisible($request->intParam('id'), $user);
        $data = Validator::validate($request->input(), [
            'status' => 'required|in:' . implode(',', self::STAFF_STATUSES),
        ]);

        if ($user['role'] === Auth::PATIENT) {
            if ($data['status'] !== 'cancelled') {
                throw new HttpException(403, 'Patients can only cancel their appointments.');
            }
            if (!in_array($appointment['status'], ['booked', 'confirmed'], true)) {
                throw new HttpException(422, 'Only upcoming appointments can be cancelled.');
            }
            $startsAt = strtotime($appointment['appointment_date'] . ' ' . $appointment['start_time']);
            if ($startsAt - time() < 2 * 3600) {
                throw new HttpException(422, 'Appointments can only be cancelled online at least 2 hours in advance. Please call the clinic.');
            }
        }

        if (in_array($appointment['status'], ['cancelled', 'no_show'], true) && !in_array($data['status'], ['cancelled', 'no_show'], true)) {
            throw new HttpException(422, 'A cancelled appointment cannot be reopened. Please create a new booking.');
        }

        Database::run('UPDATE appointments SET status = :status WHERE id = :id', ['status' => $data['status'], 'id' => (int) $appointment['id']]);
        Response::ok(null, 'Appointment status updated.');
    }

    private function slotsFor(int $branchId, string $date): array
    {
        $dayOfWeek = (int) date('w', strtotime($date));
        $minTime = $date === date('Y-m-d') ? date('H:i:s') : '00:00:00';
        $rows = Database::all(
            'SELECT s.id AS slot_id, s.start_time, s.end_time,
                    (a.id IS NULL) AS available
             FROM slots s
             LEFT JOIN appointments a
                ON a.slot_id = s.id AND a.appointment_date = :date AND a.booking_lock = 1
             WHERE s.branch_id = :branch AND s.day_of_week = :dow AND s.is_active = 1 AND s.start_time > :min_time
             ORDER BY s.start_time',
            ['date' => $date, 'branch' => $branchId, 'dow' => $dayOfWeek, 'min_time' => $minTime]
        );
        return array_map(static function (array $row): array {
            $row['available'] = (bool) $row['available'];
            return $row;
        }, $rows);
    }

    private function nextFreeSlotAt(int $branchId, string $date): ?array
    {
        foreach ($this->slotsFor($branchId, $date) as $slot) {
            if ($slot['available']) {
                return $slot;
            }
        }
        return null;
    }

    private function suggestElsewhere(int $branchId, string $fromDate): ?array
    {
        $date = new \DateTimeImmutable($fromDate);
        for ($i = 0; $i < self::SUGGESTION_SEARCH_DAYS; $i++) {
            $day = $date->modify("+{$i} day")->format('Y-m-d');
            $minTime = $day === date('Y-m-d') ? date('H:i:s') : '00:00:00';
            $row = Database::one(
                'SELECT s.id AS slot_id, s.branch_id, b.name AS branch_name, s.start_time, s.end_time
                 FROM slots s
                 JOIN branches b ON b.id = s.branch_id AND b.is_active = 1
                 WHERE s.branch_id <> :branch AND s.is_active = 1 AND s.day_of_week = :dow AND s.start_time > :min_time
                   AND NOT EXISTS (
                       SELECT 1 FROM appointments a
                       WHERE a.slot_id = s.id AND a.appointment_date = :date AND a.booking_lock = 1
                   )
                 ORDER BY s.start_time, s.branch_id
                 LIMIT 1',
                [
                    'branch' => $branchId,
                    'dow' => (int) date('w', strtotime($day)),
                    'min_time' => $minTime,
                    'date' => $day,
                ]
            );
            if ($row !== null) {
                $row['date'] = $day;
                return $row;
            }
        }
        return null;
    }

    private function activeBranch(int $id): array
    {
        $branch = Database::one('SELECT id, name FROM branches WHERE id = :id AND is_active = 1', ['id' => $id]);
        if ($branch === null) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['branch_id' => 'Select a valid branch.']);
        }
        return $branch;
    }

    private function assertWithinWindow(string $date): void
    {
        $limit = date('Y-m-d', strtotime('+' . self::BOOKING_WINDOW_DAYS . ' days'));
        if ($date > $limit) {
            throw new HttpException(422, 'Please correct the highlighted fields.', [
                'appointment_date' => 'Bookings open up to ' . self::BOOKING_WINDOW_DAYS . ' days in advance.',
                'date' => 'Bookings open up to ' . self::BOOKING_WINDOW_DAYS . ' days in advance.',
            ]);
        }
    }

    private function findVisible(int $id, array $user): array
    {
        $row = Database::one(
            'SELECT a.id, a.patient_id, a.branch_id, a.scan_type_id, a.slot_id, a.appointment_date, a.start_time,
                    s.end_time, a.status, a.notes, a.referring_doctor_id, a.created_at,
                    p.full_name AS patient_name, b.name AS branch_name, st.name AS scan_type_name,
                    st.preparation AS scan_preparation, r.full_name AS referring_doctor_name
             FROM appointments a
             JOIN users p ON p.id = a.patient_id
             JOIN branches b ON b.id = a.branch_id
             JOIN scan_types st ON st.id = a.scan_type_id
             JOIN slots s ON s.id = a.slot_id
             LEFT JOIN users r ON r.id = a.referring_doctor_id
             WHERE a.id = :id',
            ['id' => $id]
        );
        $visible = $row !== null && match ($user['role']) {
            Auth::PATIENT => (int) $row['patient_id'] === (int) $user['id'],
            Auth::REFERRING_DOCTOR => (int) $row['referring_doctor_id'] === (int) $user['id'],
            default => true,
        };
        if (!$visible) {
            throw new HttpException(404, 'Appointment not found.');
        }
        return $row;
    }
}
