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

final class SlotController
{
    private const RULES = [
        'branch_id' => 'required|id',
        'day_of_week' => 'required|int|between:0,6',
        'start_time' => 'required|time',
        'end_time' => 'required|time',
        'is_active' => 'required|bool',
    ];

    public function index(Request $request): never
    {
        Auth::require(Auth::DOCTOR, Auth::RECEPTIONIST);
        $filters = Validator::validate($request->query(), [
            'branch_id' => 'nullable|id',
            'day_of_week' => 'nullable|int|between:0,6',
        ]);
        $sql = 'SELECT s.*, b.name AS branch_name FROM slots s JOIN branches b ON b.id = s.branch_id WHERE 1 = 1';
        $params = [];
        if (!empty($filters['branch_id'])) {
            $sql .= ' AND s.branch_id = :branch';
            $params['branch'] = $filters['branch_id'];
        }
        if (isset($filters['day_of_week'])) {
            $sql .= ' AND s.day_of_week = :dow';
            $params['dow'] = $filters['day_of_week'];
        }
        $sql .= ' ORDER BY s.branch_id, s.day_of_week, s.start_time';
        Response::ok(Database::all($sql, $params));
    }

    public function store(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $data = $this->validated($request);
        try {
            $id = Database::insert(
                'INSERT INTO slots (branch_id, day_of_week, start_time, end_time, is_active)
                 VALUES (:branch, :dow, :start, :end, :active)',
                $this->params($data)
            );
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(['id' => $id], 'Slot created.', 201);
    }

    public function generate(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $data = Validator::validate($request->input(), [
            'branch_id' => 'required|id',
            'days' => 'required|array',
            'from_time' => 'required|time',
            'to_time' => 'required|time',
            'interval_minutes' => 'required|int|between:5,240',
        ]);
        $this->assertBranch($data['branch_id']);
        $days = array_values(array_unique(array_map('intval', array_filter(
            (array) $data['days'],
            static fn ($d) => (is_int($d) || (is_string($d) && ctype_digit($d))) && (int) $d >= 0 && (int) $d <= 6
        ))));
        if ($days === [] || count($days) !== count((array) $data['days'])) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['days' => 'Choose valid days of the week.']);
        }
        $from = strtotime('1970-01-01 ' . $data['from_time'] . ' UTC');
        $to = strtotime('1970-01-01 ' . $data['to_time'] . ' UTC');
        $step = $data['interval_minutes'] * 60;
        if ($to <= $from || ($to - $from) / $step > 96) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['to_time' => 'End time must be after start time (max 96 slots per day).']);
        }

        $created = 0;
        Database::transaction(function () use ($days, $from, $to, $step, $data, &$created): void {
            foreach ($days as $day) {
                for ($t = $from; $t + $step <= $to; $t += $step) {
                    $stmt = Database::run(
                        'INSERT IGNORE INTO slots (branch_id, day_of_week, start_time, end_time, is_active)
                         VALUES (:branch, :dow, :start, :end, 1)',
                        [
                            'branch' => $data['branch_id'],
                            'dow' => $day,
                            'start' => gmdate('H:i:s', $t),
                            'end' => gmdate('H:i:s', $t + $step),
                        ]
                    );
                    $created += $stmt->rowCount();
                }
            }
        });
        Response::ok(['created' => $created], "{$created} slot(s) created. Existing slots were left unchanged.", 201);
    }

    public function update(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        $data = $this->validated($request);
        try {
            Database::run(
                'UPDATE slots SET branch_id = :branch, day_of_week = :dow, start_time = :start, end_time = :end,
                 is_active = :active WHERE id = :id',
                $this->params($data) + ['id' => $id]
            );
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(null, 'Slot updated.');
    }

    public function destroy(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        $used = Database::one('SELECT 1 FROM appointments WHERE slot_id = :id LIMIT 1', ['id' => $id]);
        if ($used !== null) {
            Database::run('UPDATE slots SET is_active = 0 WHERE id = :id', ['id' => $id]);
            Response::ok(null, 'Slot has bookings, so it was deactivated instead of deleted.');
        }
        Database::run('DELETE FROM slots WHERE id = :id', ['id' => $id]);
        Response::ok(null, 'Slot deleted.');
    }

    private function validated(Request $request): array
    {
        $data = Validator::validate($request->input(), self::RULES);
        if ($data['end_time'] <= $data['start_time']) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['end_time' => 'End time must be after start time.']);
        }
        $this->assertBranch($data['branch_id']);
        return $data;
    }

    private function assertBranch(int $branchId): void
    {
        if (Database::one('SELECT 1 FROM branches WHERE id = :id', ['id' => $branchId]) === null) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['branch_id' => 'Branch does not exist.']);
        }
    }

    private function find(int $id): array
    {
        $row = Database::one('SELECT * FROM slots WHERE id = :id', ['id' => $id]);
        if ($row === null) {
            throw new HttpException(404, 'Slot not found.');
        }
        return $row;
    }

    private function params(array $data): array
    {
        return [
            'branch' => $data['branch_id'],
            'dow' => $data['day_of_week'],
            'start' => $data['start_time'],
            'end' => $data['end_time'],
            'active' => $data['is_active'] ? 1 : 0,
        ];
    }

    private function handle(PDOException $e): never
    {
        if (Database::isDuplicate($e)) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['start_time' => 'A slot already starts at this time on this day for this branch.']);
        }
        throw $e;
    }
}
