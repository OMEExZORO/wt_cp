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

final class StaffController
{
    private const MANAGED_ROLES = 'receptionist,doctor,referring_doctor';

    public function index(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $filters = Validator::validate($request->query(), [
            'role' => 'nullable|in:' . self::MANAGED_ROLES,
        ]);
        $sql = "SELECT id, full_name, email, phone, role, registration_no, is_active, last_login_at, created_at
                FROM users WHERE role IN ('receptionist', 'doctor', 'referring_doctor')";
        $params = [];
        if (!empty($filters['role'])) {
            $sql .= ' AND role = :role';
            $params['role'] = $filters['role'];
        }
        $sql .= ' ORDER BY is_active DESC, role, full_name';
        Response::ok(Database::all($sql, $params));
    }

    public function store(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $data = Validator::validate($request->input(), [
            'full_name' => 'required|string|min:2|max:120|name',
            'email' => 'required|email',
            'phone' => 'required|phone',
            'role' => 'required|in:' . self::MANAGED_ROLES,
            'registration_no' => 'nullable|string|max:50|regex:/^[A-Za-z0-9\/-]+$/',
            'password' => 'required|password',
            'is_active' => 'required|bool',
        ]);
        $this->assertRegistration($data);
        try {
            $id = Database::insert(
                'INSERT INTO users (full_name, email, phone, password_hash, role, registration_no, is_active)
                 VALUES (:name, :email, :phone, :hash, :role, :reg, :active)',
                [
                    'name' => $data['full_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'hash' => Auth::hash($data['password']),
                    'role' => $data['role'],
                    'reg' => $data['registration_no'] ?? null,
                    'active' => $data['is_active'] ? 1 : 0,
                ]
            );
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(['id' => $id], 'Staff account created.', 201);
    }

    public function update(Request $request): never
    {
        $admin = Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        $data = Validator::validate($request->input(), [
            'full_name' => 'required|string|min:2|max:120|name',
            'email' => 'required|email',
            'phone' => 'required|phone',
            'role' => 'required|in:' . self::MANAGED_ROLES,
            'registration_no' => 'nullable|string|max:50|regex:/^[A-Za-z0-9\/-]+$/',
            'password' => 'nullable|password',
            'is_active' => 'required|bool',
        ]);
        $this->assertRegistration($data);
        if ($id === (int) $admin['id'] && ($data['role'] !== Auth::DOCTOR || !$data['is_active'])) {
            throw new HttpException(422, 'You cannot remove your own admin access.', ['role' => 'You cannot change your own role or deactivate yourself.']);
        }

        try {
            Database::transaction(function () use ($id, $data): void {
                Database::run(
                    'UPDATE users SET full_name = :name, email = :email, phone = :phone, role = :role,
                     registration_no = :reg, is_active = :active WHERE id = :id',
                    [
                        'name' => $data['full_name'],
                        'email' => $data['email'],
                        'phone' => $data['phone'],
                        'role' => $data['role'],
                        'reg' => $data['registration_no'] ?? null,
                        'active' => $data['is_active'] ? 1 : 0,
                        'id' => $id,
                    ]
                );
                if (!empty($data['password'])) {
                    Database::run('UPDATE users SET password_hash = :h WHERE id = :id', ['h' => Auth::hash($data['password']), 'id' => $id]);
                }
                if (!empty($data['password']) || !$data['is_active']) {
                    Database::run('DELETE FROM remember_tokens WHERE user_id = :id', ['id' => $id]);
                }
            });
        } catch (PDOException $e) {
            $this->handle($e);
        }
        Response::ok(null, 'Staff account updated.');
    }

    public function destroy(Request $request): never
    {
        $admin = Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $this->find($id);
        if ($id === (int) $admin['id']) {
            throw new HttpException(422, 'You cannot deactivate your own account.');
        }
        Database::run('UPDATE users SET is_active = 0 WHERE id = :id', ['id' => $id]);
        Database::run('DELETE FROM remember_tokens WHERE user_id = :id', ['id' => $id]);
        Response::ok(null, 'Account deactivated. Records are retained for audit purposes.');
    }

    private function assertRegistration(array $data): void
    {
        if (in_array($data['role'], [Auth::DOCTOR, Auth::REFERRING_DOCTOR], true) && empty($data['registration_no'])) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['registration_no' => 'Registration number is required for doctors.']);
        }
    }

    private function find(int $id): array
    {
        $row = Database::one(
            "SELECT id, role FROM users WHERE id = :id AND role IN ('receptionist', 'doctor', 'referring_doctor')",
            ['id' => $id]
        );
        if ($row === null) {
            throw new HttpException(404, 'Staff member not found.');
        }
        return $row;
    }

    private function handle(PDOException $e): never
    {
        if (Database::isDuplicate($e)) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['email' => 'An account with this email already exists.']);
        }
        throw $e;
    }
}
