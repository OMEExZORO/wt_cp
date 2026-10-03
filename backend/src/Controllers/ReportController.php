<?php

declare(strict_types=1);

namespace DiagnoCare\Controllers;

use DiagnoCare\Core\Auth;
use DiagnoCare\Core\Database;
use DiagnoCare\Core\FileVault;
use DiagnoCare\Core\HttpException;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;
use DiagnoCare\Core\Validator;

final class ReportController
{
    public function index(Request $request): never
    {
        $user = Auth::require(Auth::PATIENT, Auth::DOCTOR, Auth::REFERRING_DOCTOR);
        $filters = Validator::validate($request->query(), ['patient_id' => 'nullable|id']);

        $sql = 'SELECT r.id, r.title, r.original_name, r.mime_type, r.size_bytes, r.created_at,
                       r.patient_id, p.full_name AS patient_name, r.appointment_id,
                       a.appointment_date, st.name AS scan_type_name, u.full_name AS uploaded_by_name
                FROM reports r
                JOIN users p ON p.id = r.patient_id
                JOIN users u ON u.id = r.uploaded_by
                LEFT JOIN appointments a ON a.id = r.appointment_id
                LEFT JOIN scan_types st ON st.id = a.scan_type_id
                WHERE 1 = 1';
        $params = [];

        if ($user['role'] === Auth::PATIENT) {
            $sql .= ' AND r.patient_id = :uid';
            $params['uid'] = (int) $user['id'];
        } elseif ($user['role'] === Auth::REFERRING_DOCTOR) {
            $sql .= ' AND a.referring_doctor_id = :uid';
            $params['uid'] = (int) $user['id'];
        }
        if (!empty($filters['patient_id'])) {
            $sql .= ' AND r.patient_id = :pid';
            $params['pid'] = $filters['patient_id'];
        }
        $sql .= ' ORDER BY r.created_at DESC LIMIT 500';

        Response::ok(Database::all($sql, $params));
    }

    public function store(Request $request): never
    {
        $doctor = Auth::require(Auth::DOCTOR);
        $data = Validator::validate($request->input(), [
            'patient_id' => 'required|id',
            'appointment_id' => 'nullable|id',
            'title' => 'required|string|min:3|max:150',
        ]);

        if (Database::one("SELECT 1 FROM users WHERE id = :id AND role = 'patient'", ['id' => $data['patient_id']]) === null) {
            throw new HttpException(422, 'Please correct the highlighted fields.', ['patient_id' => 'Patient not found.']);
        }
        if (!empty($data['appointment_id'])) {
            $appt = Database::one('SELECT patient_id FROM appointments WHERE id = :id', ['id' => $data['appointment_id']]);
            if ($appt === null || (int) $appt['patient_id'] !== $data['patient_id']) {
                throw new HttpException(422, 'Please correct the highlighted fields.', ['appointment_id' => 'This appointment does not belong to the selected patient.']);
            }
        }

        $file = FileVault::inspectUpload($request->file('file'));
        $stored = FileVault::store($file['tmp_name'], $file['extension']);

        try {
            $id = Database::insert(
                'INSERT INTO reports (patient_id, appointment_id, uploaded_by, title, original_name, stored_name,
                                      mime_type, size_bytes, cipher, iv, auth_tag, sha256)
                 VALUES (:patient, :appt, :uploader, :title, :original, :stored, :mime, :size, :cipher, :iv, :tag, :sha)',
                [
                    'patient' => $data['patient_id'],
                    'appt' => $data['appointment_id'] ?? null,
                    'uploader' => (int) $doctor['id'],
                    'title' => $data['title'],
                    'original' => $file['original_name'],
                    'stored' => $stored['stored_name'],
                    'mime' => $file['mime'],
                    'size' => $file['size'],
                    'cipher' => $stored['cipher'],
                    'iv' => $stored['iv'],
                    'tag' => $stored['tag'],
                    'sha' => $stored['sha256'],
                ]
            );
            if (!empty($data['appointment_id'])) {
                Database::run(
                    "UPDATE appointments SET status = 'completed' WHERE id = :id AND status IN ('booked', 'confirmed')",
                    ['id' => $data['appointment_id']]
                );
            }
        } catch (\Throwable $e) {
            FileVault::delete($stored['stored_name']);
            throw $e;
        }

        Response::ok(['id' => $id], 'Report uploaded and encrypted successfully.', 201);
    }

    public function download(Request $request): never
    {
        $user = Auth::require(Auth::PATIENT, Auth::DOCTOR, Auth::REFERRING_DOCTOR);
        $report = Database::one(
            'SELECT r.*, a.referring_doctor_id FROM reports r
             LEFT JOIN appointments a ON a.id = r.appointment_id
             WHERE r.id = :id',
            ['id' => $request->intParam('id')]
        );
        $allowed = $report !== null && match ($user['role']) {
            Auth::DOCTOR => true,
            Auth::PATIENT => (int) $report['patient_id'] === (int) $user['id'],
            Auth::REFERRING_DOCTOR => $report['referring_doctor_id'] !== null && (int) $report['referring_doctor_id'] === (int) $user['id'],
            default => false,
        };
        if (!$allowed) {
            throw new HttpException(404, 'Report not found.');
        }

        $contents = FileVault::read($report['stored_name'], $report['iv'], $report['auth_tag'], $report['sha256']);
        $ext = $report['mime_type'] === 'application/pdf' ? 'pdf' : 'jpg';
        $name = 'DiagnoCare-report-' . $report['id'] . '-' . substr((string) $report['created_at'], 0, 10) . '.' . $ext;
        Response::file($contents, $report['mime_type'], $name);
    }

    public function destroy(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        $id = $request->intParam('id');
        $report = Database::one('SELECT id, stored_name FROM reports WHERE id = :id', ['id' => $id]);
        if ($report === null) {
            throw new HttpException(404, 'Report not found.');
        }
        Database::run('DELETE FROM reports WHERE id = :id', ['id' => $id]);
        FileVault::delete($report['stored_name']);
        Response::ok(null, 'Report deleted.');
    }
}
