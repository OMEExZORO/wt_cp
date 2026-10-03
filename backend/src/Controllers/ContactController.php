<?php

declare(strict_types=1);

namespace DiagnoCare\Controllers;

use DiagnoCare\Core\Auth;
use DiagnoCare\Core\Database;
use DiagnoCare\Core\HttpException;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;
use DiagnoCare\Core\Validator;

final class ContactController
{
    public function submit(Request $request): never
    {
        $data = Validator::validate($request->input(), [
            'name' => 'required|string|min:2|max:120|name',
            'email' => 'required|email',
            'phone' => 'nullable|phone',
            'branch_id' => 'nullable|id',
            'message' => 'required|string|min:10|max:2000',
            'website' => 'nullable|string|max:0',
        ]);
        $recent = Database::one(
            'SELECT COUNT(*) AS c FROM contact_messages WHERE ip_address = :ip AND created_at > (NOW() - INTERVAL 1 HOUR)',
            ['ip' => $request->ip()]
        );
        if ((int) $recent['c'] >= 5) {
            throw new HttpException(429, 'You have sent several messages recently. Please call the clinic instead.');
        }
        if (!empty($data['branch_id']) && Database::one('SELECT 1 FROM branches WHERE id = :id AND is_active = 1', ['id' => $data['branch_id']]) === null) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['branch_id' => 'Select a valid branch.']);
        }
        Database::insert(
            'INSERT INTO contact_messages (name, email, phone, branch_id, message, ip_address)
             VALUES (:name, :email, :phone, :branch, :message, :ip)',
            [
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'branch' => $data['branch_id'] ?? null,
                'message' => $data['message'],
                'ip' => $request->ip(),
            ]
        );
        Response::ok(null, 'Thank you! Our team will get back to you shortly.', 201);
    }

    public function index(Request $request): never
    {
        Auth::require(Auth::DOCTOR, Auth::RECEPTIONIST);
        Response::ok(Database::all(
            'SELECT m.id, m.name, m.email, m.phone, m.message, m.is_read, m.created_at, b.name AS branch_name
             FROM contact_messages m LEFT JOIN branches b ON b.id = m.branch_id
             ORDER BY m.is_read, m.created_at DESC LIMIT 200'
        ));
    }

    public function markRead(Request $request): never
    {
        Auth::require(Auth::DOCTOR, Auth::RECEPTIONIST);
        $id = $request->intParam('id');
        $stmt = Database::run('UPDATE contact_messages SET is_read = 1 WHERE id = :id', ['id' => $id]);
        if ($stmt->rowCount() === 0 && Database::one('SELECT 1 FROM contact_messages WHERE id = :id', ['id' => $id]) === null) {
            throw new HttpException(404, 'Message not found.');
        }
        Response::ok(null, 'Marked as read.');
    }
}
