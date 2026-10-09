<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ConflictException;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Models\Branch;
use App\Models\Model;
use App\Models\Slot;
use App\Services\AuditLogger;
use App\Services\Booking\SlotGenerator;

final class SlotAdminController extends AdminController
{
    public const MAX_GENERATED_ROWS = 20000;

    public function __construct(
        AuditLogger $audit,
        private readonly AdminRepository $repository,
        private readonly Slot $slots,
        private readonly Branch $branches
    ) {
        parent::__construct($audit);
    }

    public function index(Request $request): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request);
        $filters = $this->validate($request, [
            'branch_id' => 'nullable|uuid',
            'modality' => 'nullable|in:USG,CT,BIOPSY',
            'date' => 'nullable|date',
        ]);
        $filters = array_filter($filters, static fn (mixed $value): bool => $value !== null);
        $rows = array_map($this->present(...), $this->repository->slots($filters, $perPage, $offset));
        return $this->paged('slots', $rows, $this->repository->slotCount($filters), $page, $perPage);
    }

    public function update(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $data = $this->validate($request, [
            'capacity' => 'sometimes|required|integer|min:1|max:50',
            'is_blocked' => 'sometimes|required|boolean',
        ]);
        if ($data === []) {
            throw new ValidationException(['capacity' => 'Provide a capacity or a blocked flag.']);
        }
        $before = $this->requireFound($this->repository->slotById($id), 'Slot');
        $this->repository->transaction(function () use ($id, $data): void {
            $locked = $this->repository->lockSlot($id);
            $capacity = (int) ($data['capacity'] ?? $locked['capacity']);
            if ($capacity < (int) $locked['booked_count']) {
                throw new ConflictException(
                    sprintf('This slot already has %d booking(s); capacity cannot be lower.', (int) $locked['booked_count']),
                    ['capacity' => 'Capacity cannot be lower than the current bookings.']
                );
            }
            $blocked = array_key_exists('is_blocked', $data) ? (bool) $data['is_blocked'] : Model::flag($locked['is_blocked']);
            $this->repository->updateSlot($id, $capacity, $blocked);
        });
        $this->record($request, 'admin.slot_updated', 'slot', $id, [
            'capacity_before' => (int) $before['capacity'],
            'blocked_before' => Model::flag($before['is_blocked']),
            'fields' => array_keys($data),
        ]);
        return $this->ok($this->present($this->repository->slotById($id) ?? $before));
    }

    public function destroy(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $slot = $this->requireFound($this->repository->slotById($id), 'Slot');
        if ((int) $slot['booked_count'] > 0) {
            throw new ConflictException('This slot has bookings. Block it instead of deleting it.');
        }
        return $this->deleteRecord($request, $this->slots, $id, 'slot', 'Slot');
    }

    public function generate(Request $request): Response
    {
        $data = $this->validate($request, [
            'from' => 'required|date|after_or_equal:today',
            'days' => 'required|integer|min:1|max:90',
            'open' => 'required|time',
            'close' => 'required|time',
            'interval' => 'required|integer|min:5|max:240',
            'branch_id' => 'nullable|uuid',
            'capacity_usg' => 'nullable|integer|min:0|max:50',
            'capacity_ct' => 'nullable|integer|min:0|max:50',
            'capacity_biopsy' => 'nullable|integer|min:0|max:50',
            'closed_weekdays' => ['nullable', 'regex:/^[1-7](,[1-7]){0,6}$/'],
            'dry_run' => 'nullable|boolean',
        ]);

        $capacities = [];
        foreach (['USG' => 'capacity_usg', 'CT' => 'capacity_ct', 'BIOPSY' => 'capacity_biopsy'] as $modality => $field) {
            $value = $data[$field] ?? null;
            if ($value !== null && (int) $value > 0) {
                $capacities[$modality] = (int) $value;
            }
        }
        if ($capacities === []) {
            throw ValidationException::withField('capacity_usg', 'Set a capacity for at least one modality.');
        }

        $branchIds = $this->branchIds($data['branch_id'] ?? null);
        $closed = array_map('intval', explode(',', (string) ($data['closed_weekdays'] ?? '7')));

        try {
            $rows = SlotGenerator::plan($branchIds, $capacities, $data['from'], (int) $data['days'], $data['open'], $data['close'], (int) $data['interval'], $closed);
        } catch (\InvalidArgumentException $e) {
            throw ValidationException::withField('close', $e->getMessage());
        }
        if (count($rows) > self::MAX_GENERATED_ROWS) {
            throw ValidationException::withField('days', 'That would create too many slots. Reduce the days, interval or branches.');
        }

        $dryRun = (bool) ($data['dry_run'] ?? false);
        $inserted = 0;
        if (!$dryRun) {
            $inserted = (int) $this->slots->transaction(fn (): int => (new SlotGenerator($this->slots))->insert($rows));
            $this->record($request, 'admin.slots_generated', 'slot', 'bulk', [
                'from' => $data['from'], 'days' => (int) $data['days'], 'candidates' => count($rows), 'inserted' => $inserted, 'branches' => count($branchIds),
            ]);
        }
        return $this->ok(['candidates' => count($rows), 'inserted' => $inserted, 'skipped_existing' => $dryRun ? 0 : count($rows) - $inserted, 'dry_run' => $dryRun]);
    }

    private function branchIds(?string $branchId): array
    {
        if ($branchId !== null) {
            $branch = $this->branches->find($branchId);
            if ($branch === null || !Model::flag($branch['is_active'])) {
                throw ValidationException::withField('branch_id', 'Choose an active branch.');
            }
            return [$branchId];
        }
        $ids = array_map(static fn (array $row): string => (string) $row['id'], $this->branches->listActive());
        if ($ids === []) {
            throw ValidationException::withField('branch_id', 'There are no active branches.');
        }
        return $ids;
    }

    private function present(array $row): array
    {
        return [
            'id' => $row['id'],
            'branch_id' => $row['branch_id'],
            'branch_name' => $row['branch_name'] ?? null,
            'modality' => $row['modality'],
            'slot_date' => $row['slot_date'],
            'start_time' => substr((string) $row['start_time'], 0, 5),
            'end_time' => substr((string) $row['end_time'], 0, 5),
            'capacity' => (int) $row['capacity'],
            'booked_count' => (int) $row['booked_count'],
            'is_blocked' => Model::flag($row['is_blocked']),
        ];
    }
}
