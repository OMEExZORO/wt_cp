<?php

declare(strict_types=1);

use DiagnoCare\Controllers\AppointmentController;
use DiagnoCare\Controllers\AuthController;
use DiagnoCare\Controllers\BranchController;
use DiagnoCare\Controllers\ClinicalController;
use DiagnoCare\Controllers\ContactController;
use DiagnoCare\Controllers\MetaController;
use DiagnoCare\Controllers\PatientController;
use DiagnoCare\Controllers\ReportController;
use DiagnoCare\Controllers\ScanTypeController;
use DiagnoCare\Controllers\SlotController;
use DiagnoCare\Controllers\StaffController;
use DiagnoCare\Core\Router;

return static function (Router $r): void {
    $r->get('/health', [MetaController::class, 'health']);
    $r->get('/csrf', [MetaController::class, 'csrf']);

    $r->post('/auth/register', [AuthController::class, 'register']);
    $r->post('/auth/login', [AuthController::class, 'login']);
    $r->post('/auth/logout', [AuthController::class, 'logout']);
    $r->get('/auth/me', [AuthController::class, 'me']);
    $r->put('/auth/profile', [AuthController::class, 'updateProfile']);
    $r->put('/auth/password', [AuthController::class, 'changePassword']);

    $r->get('/branches', [BranchController::class, 'publicList']);
    $r->get('/scan-types', [ScanTypeController::class, 'publicList']);
    $r->post('/contact', [ContactController::class, 'submit']);

    $r->get('/appointments/availability', [AppointmentController::class, 'availability']);
    $r->get('/appointments', [AppointmentController::class, 'index']);
    $r->post('/appointments', [AppointmentController::class, 'store']);
    $r->get('/appointments/{id}', [AppointmentController::class, 'show']);
    $r->patch('/appointments/{id}/status', [AppointmentController::class, 'updateStatus']);

    $r->get('/patients', [PatientController::class, 'search']);
    $r->get('/referring-doctors', [PatientController::class, 'referringDoctors']);

    $r->get('/reports', [ReportController::class, 'index']);
    $r->post('/reports', [ReportController::class, 'store']);
    $r->get('/reports/{id}/download', [ReportController::class, 'download']);
    $r->delete('/reports/{id}', [ReportController::class, 'destroy']);

    $r->get('/admin/branches', [BranchController::class, 'index']);
    $r->post('/admin/branches', [BranchController::class, 'store']);
    $r->put('/admin/branches/{id}', [BranchController::class, 'update']);
    $r->delete('/admin/branches/{id}', [BranchController::class, 'destroy']);

    $r->get('/admin/scan-types', [ScanTypeController::class, 'index']);
    $r->post('/admin/scan-types', [ScanTypeController::class, 'store']);
    $r->put('/admin/scan-types/{id}', [ScanTypeController::class, 'update']);
    $r->delete('/admin/scan-types/{id}', [ScanTypeController::class, 'destroy']);

    $r->get('/admin/slots', [SlotController::class, 'index']);
    $r->post('/admin/slots', [SlotController::class, 'store']);
    $r->post('/admin/slots/generate', [SlotController::class, 'generate']);
    $r->put('/admin/slots/{id}', [SlotController::class, 'update']);
    $r->delete('/admin/slots/{id}', [SlotController::class, 'destroy']);

    $r->get('/admin/staff', [StaffController::class, 'index']);
    $r->post('/admin/staff', [StaffController::class, 'store']);
    $r->put('/admin/staff/{id}', [StaffController::class, 'update']);
    $r->delete('/admin/staff/{id}', [StaffController::class, 'destroy']);

    $r->get('/admin/messages', [ContactController::class, 'index']);
    $r->patch('/admin/messages/{id}/read', [ContactController::class, 'markRead']);

    $r->get('/clinical/checklists', [ClinicalController::class, 'checklists']);
    $r->get('/clinical/alerts', [ClinicalController::class, 'alerts']);
    $r->post('/clinical/alerts/{id}/acknowledge', [ClinicalController::class, 'notImplemented']);
    $r->post('/clinical/alerts/{id}/escalate', [ClinicalController::class, 'notImplemented']);
    $r->get('/clinical/reading-queue', [ClinicalController::class, 'readingQueue']);
};
