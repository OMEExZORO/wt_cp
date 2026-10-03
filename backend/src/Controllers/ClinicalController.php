<?php

declare(strict_types=1);

namespace DiagnoCare\Controllers;

use DiagnoCare\Core\Auth;
use DiagnoCare\Core\Database;
use DiagnoCare\Core\HttpException;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;
use DiagnoCare\Core\Validator;

final class ClinicalController
{
    public function checklists(Request $request): never
    {
        Auth::require(Auth::DOCTOR, Auth::RECEPTIONIST);
        $filters = Validator::validate($request->query(), ['scan_type_id' => 'nullable|id']);
        $sql = 'SELECT i.id, i.scan_type_id, st.name AS scan_type_name, i.question, i.is_required,
                       i.blocks_scan_if_yes, i.sort_order
                FROM safety_checklist_items i JOIN scan_types st ON st.id = i.scan_type_id
                WHERE i.is_active = 1';
        $params = [];
        if (!empty($filters['scan_type_id'])) {
            $sql .= ' AND i.scan_type_id = :sid';
            $params['sid'] = $filters['scan_type_id'];
        }
        Response::ok(Database::all($sql . ' ORDER BY st.name, i.sort_order', $params));
    }

    public function alerts(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        Response::ok(Database::all(
            'SELECT c.id, c.finding, c.severity, c.status, c.escalation_level, c.created_at, c.acknowledged_at,
                    p.full_name AS patient_name, n.full_name AS notify_name
             FROM critical_alerts c
             JOIN users p ON p.id = c.patient_id
             LEFT JOIN users n ON n.id = c.notify_user_id
             ORDER BY c.created_at DESC LIMIT 200'
        ));
    }

    public function readingQueue(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        Response::ok(Database::all(
            "SELECT q.id, q.priority, q.status, q.queued_at, a.appointment_date, a.start_time,
                    p.full_name AS patient_name, st.name AS scan_type_name, b.name AS branch_name
             FROM reading_queue q
             JOIN appointments a ON a.id = q.appointment_id
             JOIN users p ON p.id = a.patient_id
             JOIN scan_types st ON st.id = a.scan_type_id
             JOIN branches b ON b.id = a.branch_id
             ORDER BY FIELD(q.priority, 'stat', 'urgent', 'routine'), q.queued_at LIMIT 200"
        ));
    }

    public function notImplemented(Request $request): never
    {
        Auth::require(Auth::DOCTOR);
        throw new HttpException(501, 'This workflow is planned but not implemented yet.');
    }
}
