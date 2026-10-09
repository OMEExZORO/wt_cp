<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\NotFoundException;
use App\Exceptions\PayloadTooLargeException;
use App\Exceptions\ValidationException;
use App\Models\Appointment;
use App\Models\Report;
use App\Models\ReportAccessLog;
use App\Services\AuditLogger;
use App\Services\Reports\ReportAccessPolicy;
use App\Services\Reports\ReportPresenter;
use App\Services\Reports\ReportService;
use App\Services\Reports\UploadedFileValidator;

final class ReportController extends Controller
{
    public function __construct(
        private readonly Report $reports,
        private readonly Appointment $appointments,
        private readonly ReportAccessLog $accessLog,
        private readonly ReportService $service,
        private readonly ReportPresenter $presenter,
        private readonly UploadedFileValidator $files,
        private readonly AuditLogger $audit
    ) {
    }

    public function index(Request $request): Response
    {
        $user = $this->user($request);
        $filters = $this->validate($request, [
            'patient_id' => 'nullable|uuid',
            'appointment_id' => 'nullable|uuid',
            'status' => 'nullable|in:' . implode(',', Report::STATUSES),
            'q' => 'nullable|string|max:80',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'page' => 'nullable|integer|min:1|max:1000',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 20);
        $rows = $this->reports->listVisible($user, $filters, $perPage, ($page - 1) * $perPage);
        $rows = array_values(array_filter($rows, static fn (array $row): bool => ReportAccessPolicy::canView($user, $row)));
        $total = $this->reports->countVisible($user, $filters);
        $items = array_map(fn (array $row): array => $this->presenter->summary($row), $rows);
        return $this->ok(['reports' => $items], 200, ['page' => $page, 'per_page' => $perPage, 'total' => $total]);
    }

    public function store(Request $request): Response
    {
        $user = $this->user($request);
        $declared = (int) $request->header('content-length', '0');
        if ($declared > UploadedFileValidator::MAX_BYTES + 1048576) {
            throw new PayloadTooLargeException('The file is too large. The limit is 10 MB.', ['file' => 'The file is too large. The limit is 10 MB.']);
        }
        $data = $this->validate($request, [
            'appointment_id' => 'required|uuid',
            'patient_id' => 'nullable|uuid',
            'title' => 'required|string|min:2|max:200',
            'notes' => 'nullable|text|max:5000',
            'impression' => 'nullable|text|max:5000',
            'status' => 'nullable|in:draft,final',
        ]);

        $appointment = $this->appointments->findDetailed($data['appointment_id']);
        if ($appointment === null || $appointment['status'] === 'cancelled') {
            throw ValidationException::withField('appointment_id', 'Choose an existing, non-cancelled appointment.');
        }
        if (!empty($data['patient_id']) && (string) $data['patient_id'] !== (string) $appointment['patient_id']) {
            throw ValidationException::withField('patient_id', 'This appointment belongs to a different patient.');
        }

        $upload = $this->files->validate($request->files()['file'] ?? null);

        $id = $this->service->store(
            $user,
            $appointment,
            $upload,
            [
                'title' => $data['title'],
                'notes' => $data['notes'] ?? null,
                'impression' => $data['impression'] ?? null,
                'status' => $data['status'] ?? 'final',
            ],
            $request->ip(),
            $request->userAgent()
        );

        $this->audit->log('report.uploaded', $request, [
            'entity_type' => 'report',
            'entity_id' => $id,
            'metadata' => [
                'appointment_id' => $appointment['id'],
                'patient_id' => $appointment['patient_id'],
                'mime_type' => $upload['mime_type'],
                'size_bytes' => $upload['size_bytes'],
            ],
        ]);

        $row = $this->reports->findDetailed($id) ?? throw new NotFoundException('Report not found.');
        return $this->created(['report' => $this->presenter->detail($row, $user)]);
    }

    public function show(Request $request): Response
    {
        $user = $this->user($request);
        $row = $this->authorized($request, $user);
        $this->accessLog->record((string) $row['id'], (string) $user['id'], 'view', $request->ip(), $request->userAgent());
        return $this->ok(['report' => $this->presenter->detail($row, $user)]);
    }

    public function download(Request $request): Response
    {
        $user = $this->user($request);
        $row = $this->authorized($request, $user);
        $plaintext = $this->service->read($row);
        $this->accessLog->record((string) $row['id'], (string) $user['id'], 'download', $request->ip(), $request->userAgent());
        $this->audit->log('report.downloaded', $request, ['entity_type' => 'report', 'entity_id' => $row['id']]);

        $filename = UploadedFileValidator::cleanName((string) $row['original_filename']);
        if ($filename === '') {
            $filename = 'report';
        }
        return new Response($plaintext, 200, [
            'Content-Type' => (string) $row['mime_type'],
            'Content-Length' => (string) strlen($plaintext),
            'Content-Disposition' => 'attachment; filename="' . str_replace('"', '', $filename) . '"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'no-store, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }

    public function update(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, [
            'title' => 'sometimes|required|string|min:2|max:200',
            'notes' => 'sometimes|nullable|text|max:5000',
            'impression' => 'sometimes|nullable|text|max:5000',
            'status' => 'sometimes|required|in:' . implode(',', Report::STATUSES),
        ]);
        if ($data === []) {
            throw new ValidationException(['title' => 'Provide at least one field to update.']);
        }
        $row = $this->authorized($request, $user);
        $this->service->update($row, $data);
        $this->audit->log('report.updated', $request, [
            'entity_type' => 'report',
            'entity_id' => $row['id'],
            'metadata' => ['fields' => array_keys($data), 'status' => $data['status'] ?? null],
        ]);
        $updated = $this->reports->findDetailed((string) $row['id']) ?? throw new NotFoundException('Report not found.');
        return $this->ok(['report' => $this->presenter->detail($updated, $user)]);
    }

    public function destroy(Request $request): Response
    {
        $user = $this->user($request);
        if (!ReportAccessPolicy::canDelete($user)) {
            throw new NotFoundException('Report not found.');
        }
        $row = $this->authorized($request, $user);
        $this->service->remove($row);
        $this->accessLog->record((string) $row['id'], (string) $user['id'], 'delete', $request->ip(), $request->userAgent());
        $this->audit->log('report.deleted', $request, ['entity_type' => 'report', 'entity_id' => $row['id']]);
        return $this->noContent();
    }

    private function authorized(Request $request, array $user): array
    {
        $row = $this->reports->findDetailed((string) $request->param('id'));
        if ($row === null) {
            throw new NotFoundException('Report not found.');
        }
        if (!ReportAccessPolicy::canView($user, $row)) {
            $this->accessLog->record((string) $row['id'], (string) $user['id'], 'denied', $request->ip(), $request->userAgent());
            $this->audit->log('report.access_denied', $request, ['entity_type' => 'report', 'entity_id' => $row['id']]);
            throw new NotFoundException('Report not found.');
        }
        return $row;
    }
}
