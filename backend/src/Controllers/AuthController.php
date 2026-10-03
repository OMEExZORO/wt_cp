<?php

declare(strict_types=1);

namespace DiagnoCare\Controllers;

use DiagnoCare\Core\Auth;
use DiagnoCare\Core\Config;
use DiagnoCare\Core\Csrf;
use DiagnoCare\Core\Database;
use DiagnoCare\Core\HttpException;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;
use DiagnoCare\Core\Session;
use DiagnoCare\Core\Validator;
use PDOException;

final class AuthController
{
    public function register(Request $request): never
    {
        if (Auth::user() !== null) {
            throw new HttpException(409, 'You are already logged in.');
        }
        $data = Validator::validate($request->input(), [
            'full_name' => 'required|string|min:2|max:120|name',
            'email' => 'required|email',
            'phone' => 'required|phone',
            'password' => 'required|password',
            'password_confirmation' => 'required|string',
            'role' => 'nullable|in:patient,referring_doctor',
            'date_of_birth' => 'nullable|date|past_date',
            'gender' => 'nullable|in:male,female,other',
            'registration_no' => 'nullable|string|max:50|regex:/^[A-Za-z0-9\/-]+$/',
        ]);

        if (!hash_equals($data['password'], $data['password_confirmation'])) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['password_confirmation' => 'Passwords do not match.']);
        }
        $role = $data['role'] ?? Auth::PATIENT;
        if ($role === Auth::REFERRING_DOCTOR && empty($data['registration_no'])) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['registration_no' => 'Medical registration number is required for referring doctors.']);
        }
        $isActive = $role === Auth::PATIENT ? 1 : 0;

        try {
            $id = Database::insert(
                'INSERT INTO users (full_name, email, phone, password_hash, role, date_of_birth, gender, registration_no, is_active)
                 VALUES (:name, :email, :phone, :hash, :role, :dob, :gender, :reg, :active)',
                [
                    'name' => $data['full_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'hash' => Auth::hash($data['password']),
                    'role' => $role,
                    'dob' => $data['date_of_birth'] ?? null,
                    'gender' => $data['gender'] ?? null,
                    'reg' => $role === Auth::REFERRING_DOCTOR ? $data['registration_no'] : null,
                    'active' => $isActive,
                ]
            );
        } catch (PDOException $e) {
            if (Database::isDuplicate($e)) {
                throw new HttpException(422, 'Please correct the highlighted fields.', ['email' => 'An account with this email already exists.']);
            }
            throw $e;
        }

        if ($isActive === 1) {
            Auth::login($id, false);
            Response::ok($this->sessionPayload(), 'Registration successful. Welcome to DiagnoCare!', 201);
        }
        Response::ok(['pending_approval' => true], 'Registration received. The clinic will verify your registration number and activate your account.', 201);
    }

    public function login(Request $request): never
    {
        $data = Validator::validate($request->input(), [
            'email' => 'required|email',
            'password' => 'required|string|max:72',
            'remember' => 'nullable|bool',
        ]);
        Auth::attempt($data['email'], $data['password'], (bool) ($data['remember'] ?? false), $request->ip());
        Response::ok($this->sessionPayload(), 'Logged in successfully.');
    }

    public function logout(Request $request): never
    {
        Auth::logout();
        session_start();
        Response::ok(['csrf_token' => Csrf::rotate()], 'You have been logged out.');
    }

    public function me(Request $request): never
    {
        $user = Auth::user();
        Response::ok([
            'user' => $user,
            'csrf_token' => Csrf::token(),
            'session_timeout' => (int) Config::get('session.idle_timeout'),
            'session_expired' => $user === null && Session::wasExpired(),
        ]);
    }

    public function updateProfile(Request $request): never
    {
        $user = Auth::require();
        $data = Validator::validate($request->input(), [
            'full_name' => 'required|string|min:2|max:120|name',
            'phone' => 'required|phone',
            'date_of_birth' => 'nullable|date|past_date',
            'gender' => 'nullable|in:male,female,other',
        ]);
        Database::run(
            'UPDATE users SET full_name = :name, phone = :phone, date_of_birth = :dob, gender = :gender WHERE id = :id',
            [
                'name' => $data['full_name'],
                'phone' => $data['phone'],
                'dob' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'id' => (int) $user['id'],
            ]
        );
        Response::ok(null, 'Profile updated.');
    }

    public function changePassword(Request $request): never
    {
        $user = Auth::require();
        $data = Validator::validate($request->input(), [
            'current_password' => 'required|string|max:72',
            'new_password' => 'required|password',
            'new_password_confirmation' => 'required|string',
        ]);
        $row = Database::one('SELECT password_hash FROM users WHERE id = :id', ['id' => (int) $user['id']]);
        if ($row === null || !password_verify($data['current_password'], $row['password_hash'])) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['current_password' => 'Current password is incorrect.']);
        }
        if (!hash_equals($data['new_password'], $data['new_password_confirmation'])) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['new_password_confirmation' => 'Passwords do not match.']);
        }
        Database::run('UPDATE users SET password_hash = :h WHERE id = :id', ['h' => Auth::hash($data['new_password']), 'id' => (int) $user['id']]);
        Database::run('DELETE FROM remember_tokens WHERE user_id = :id', ['id' => (int) $user['id']]);
        Auth::login((int) $user['id'], false);
        Response::ok(['csrf_token' => Csrf::token()], 'Password changed. Other devices have been signed out.');
    }

    private function sessionPayload(): array
    {
        return [
            'user' => Auth::user(),
            'csrf_token' => Csrf::token(),
            'session_timeout' => (int) Config::get('session.idle_timeout'),
        ];
    }
}
