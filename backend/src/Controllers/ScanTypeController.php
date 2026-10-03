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

final class ScanTypeController
{
    private const RULES = [
        'name' => 'required|string|min:2|max:120',
        'category' => 'required|in:xray,sonography,colour_doppler',
        'description' => 'required|string|min:5|max:1000',
        'preparation' => 'nullable|string|max:1000',
        'duration_minutes' => 'required|int|between:5,240',
        'price' => 'required|decimal',
        'is_active' => 'required|bool',
    ];

    public function publicList(Request $request): never
    {
        Response::ok(Database::all(
            'SELECT id, name, category, description, preparation, duration_minutes, price
             FROM scan_types WHERE is_active = 1 ORDER BY category, name'
        ));
    }

    public function index(Request $request): never
    {
        Auth::require(Auth::DOCTOR, Auth::RECEPTIONIST);
        Response::ok(Database::all('SELECT * FROM scan_types ORDER BY category, name'));
    }

    public function store(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $data = Validator::validate($request->input(), self::RULES);
        try {
            $id = Database::insert(
                'INSERT INTO scan_types (name, category, description, preparation, duration_minutes, price, is_active)
                 VALUES (:name, :category, :description, :preparation, :duration, :price, :is_active)',
                $this->params($data)
            );
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(['id' => $id], 'Scan type created.', 201);
    }

    public function update(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        $data = Validator::validate($request->input(), self::RULES);
        try {
            Database::run(
                'UPDATE scan_types SET name = :name, category = :category, description = :description,
                 preparation = :preparation, duration_minutes = :duration, price = :price, is_active = :is_active
                 WHERE id = :id',
                $this->params($data) + ['id' => $id]
            );
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(null, 'Scan type updated.');
    }

    public function destroy(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        $used = Database::one('SELECT 1 FROM appointments WHERE scan_type_id = :id LIMIT 1', ['id' => $id]);
        if ($used !== null) {
            Database::run('UPDATE scan_types SET is_active = 0 WHERE id = :id', ['id' => $id]);
            Response::ok(null, 'Scan type has appointment history, so it was deactivated instead of deleted.');
        }
        Database::run('DELETE FROM scan_types WHERE id = :id', ['id' => $id]);
        Response::ok(null, 'Scan type deleted.');
    }

    private function find(int $id): array
    {
        $row = Database::one('SELECT * FROM scan_types WHERE id = :id', ['id' => $id]);
        if ($row === null) {
            throw new HttpException(404, 'Scan type not found.');
        }
        return $row;
    }

    private function params(array $data): array
    {
        return [
            'name' => $data['name'],
            'category' => $data['category'],
            'description' => $data['description'],
            'preparation' => $data['preparation'] ?? null,
            'duration' => $data['duration_minutes'],
            'price' => number_format((float) $data['price'], 2, '.', ''),
            'is_active' => $data['is_active'] ? 1 : 0,
        ];
    }

    private function handle(PDOException $e): never
    {
        if (Database::isDuplicate($e)) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['name' => 'A scan type with this name already exists.']);
        }
        throw $e;
    }
}
