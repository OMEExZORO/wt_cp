<?php

declare(strict_types=1);

namespace DiagnoCare\Controllers;

use DiagnoCare\Core\Auth;
use DiagnoCare\Core\Database;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;
use DiagnoCare\Core\Validator;

final class PatientController
{
    public function search(Request $request): never
    {
        Auth::require(Auth::DOCTOR, Auth::RECEPTIONIST);
        $data = Validator::validate($request->query(), ['q' => 'nullable|string|max:100']);
        $term = $data['q'] ?? '';
        $like = '%' . addcslashes($term, '%_\\') . '%';
        Response::ok(Database::all(
            "SELECT id, full_name, email, phone, date_of_birth, gender FROM users
             WHERE role = 'patient' AND is_active = 1
               AND (full_name LIKE :q1 OR email LIKE :q2 OR phone LIKE :q3)
             ORDER BY full_name LIMIT 25",
            ['q1' => $like, 'q2' => $like, 'q3' => $like]
        ));
    }

    public function referringDoctors(Request $request): never
    {
        Auth::require();
        Response::ok(Database::all(
            "SELECT id, full_name, registration_no FROM users
             WHERE role = 'referring_doctor' AND is_active = 1 ORDER BY full_name"
        ));
    }
}
