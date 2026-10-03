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

final class BranchController
{
    private const RULES = [
        'name' => 'required|string|min:3|max:120',
        'address_line' => 'required|string|min:5|max:255',
        'city' => 'required|string|min:2|max:80|name',
        'pincode' => 'required|pincode',
        'phone' => 'required|landline_or_phone',
        'email' => 'nullable|email',
        'timings' => 'required|string|min:3|max:255',
        'map_query' => 'required|string|min:3|max:255',
        'image_file' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9-]+\.(jpg|jpeg|png|webp)$/'],
        'is_active' => 'required|bool',
    ];

    public function publicList(Request $request): never
    {
        Response::ok(Database::all(
            'SELECT id, name, address_line, city, pincode, phone, email, timings, map_query, image_file
             FROM branches WHERE is_active = 1 ORDER BY id'
        ));
    }

    public function index(Request $request): never
    {
        Auth::require(Auth::DOCTOR, Auth::RECEPTIONIST);
        Response::ok(Database::all('SELECT * FROM branches ORDER BY id'));
    }

    public function store(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $data = Validator::validate($request->input(), self::RULES);
        try {
            $id = Database::insert(
                'INSERT INTO branches (name, address_line, city, pincode, phone, email, timings, map_query, image_file, is_active)
                 VALUES (:name, :address_line, :city, :pincode, :phone, :email, :timings, :map_query, :image_file, :is_active)',
                $this->params($data)
            );
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(['id' => $id], 'Branch created.', 201);
    }

    public function update(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        $data = Validator::validate($request->input(), self::RULES);
        try {
            Database::run(
                'UPDATE branches SET name = :name, address_line = :address_line, city = :city, pincode = :pincode,
                 phone = :phone, email = :email, timings = :timings, map_query = :map_query,
                 image_file = :image_file, is_active = :is_active WHERE id = :id',
                $this->params($data) + ['id' => $id]
            );
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(null, 'Branch updated.');
    }

    public function destroy(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        $hasBookings = Database::one('SELECT 1 FROM appointments WHERE branch_id = :id LIMIT 1', ['id' => $id]);
        if ($hasBookings !== null) {
            Database::run('UPDATE branches SET is_active = 0 WHERE id = :id', ['id' => $id]);
            Response::ok(null, 'Branch has appointment history, so it was deactivated instead of deleted.');
        }
        Database::run('DELETE FROM branches WHERE id = :id', ['id' => $id]);
        Response::ok(null, 'Branch deleted.');
    }

    private function find(int $id): array
    {
        $row = Database::one('SELECT * FROM branches WHERE id = :id', ['id' => $id]);
        if ($row === null) {
            throw new HttpException(404, 'Branch not found.');
        }
        return $row;
    }

    private function params(array $data): array
    {
        return [
            'name' => $data['name'],
            'address_line' => $data['address_line'],
            'city' => $data['city'],
            'pincode' => $data['pincode'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'timings' => $data['timings'],
            'map_query' => $data['map_query'],
            'image_file' => $data['image_file'] ?? null,
            'is_active' => $data['is_active'] ? 1 : 0,
        ];
    }

    private function handle(PDOException $e): never
    {
        if (Database::isDuplicate($e)) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['name' => 'A branch with this name already exists.']);
        }
        throw $e;
    }
}
