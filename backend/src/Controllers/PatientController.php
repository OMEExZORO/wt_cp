<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Patient;
use App\Services\AuditLogger;

final class PatientController extends Controller
{
    public function __construct(
        private readonly Patient $patients,
        private readonly AuditLogger $audit
    ) {
    }

    public function lookup(Request $request): Response
    {
        $data = $this->validate($request, ['q' => 'required|string|min:3|max:60']);
        $rows = $this->patients->search($data['q'], 10);
        $this->audit->log('patient.lookup', $request, [
            'entity_type' => 'patient',
            'metadata' => ['results' => count($rows)],
        ]);
        return $this->ok(['patients' => array_map(static fn (array $row): array => [
            'id' => $row['id'],
            'full_name' => $row['full_name'],
            'phone' => $row['phone'],
        ], $rows)]);
    }
}
