<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\NotFoundException;
use App\Exceptions\ValidationException;
use App\Models\Branch;
use App\Models\ChecklistItem;
use App\Models\Model;
use App\Models\ScanType;
use App\Models\Slot;
use App\Services\Booking\BookingService;
use App\Services\Booking\SlotPresenter;
use App\Services\Clock;

final class BookingController extends Controller
{
    public const BOOKING_WINDOW_DAYS = 90;

    public function __construct(
        private readonly Branch $branches,
        private readonly ScanType $scanTypes,
        private readonly Slot $slots,
        private readonly ChecklistItem $checklist,
        private readonly BookingService $booking,
        private readonly Clock $clock
    ) {
    }

    public function availability(Request $request): Response
    {
        $data = $this->validate($request, [
            'branch_id' => 'required|uuid',
            'scan_type_id' => 'required|uuid',
            'date' => 'required|date|after_or_equal:today|before_or_equal:' . $this->lastBookableDate(),
        ]);
        $branch = $this->branches->findActive($data['branch_id']);
        if ($branch === null) {
            throw ValidationException::withField('branch_id', 'Choose one of our branches.');
        }
        $scan = $this->scanType($data['scan_type_id']);
        $now = $this->clock->now();
        $rows = $this->slots->forDay($data['branch_id'], (string) $scan['modality'], $data['date']);
        $slots = array_map(static fn (array $row): array => SlotPresenter::present($row, $now), $rows);
        $available = count(array_filter($slots, static fn (array $slot): bool => $slot['is_available']));
        $suggestion = null;
        if ($available === 0) {
            $suggestion = $this->booking->nextAvailable((string) $scan['modality'], $data['date'], $data['branch_id']);
        }
        return $this->ok([
            'date' => $data['date'],
            'branch' => ['id' => $branch['id'], 'name' => $branch['name'], 'slug' => $branch['slug']],
            'scan_type' => ['id' => $scan['id'], 'name' => $scan['name'], 'modality' => $scan['modality']],
            'slots' => $slots,
            'summary' => [
                'total' => count($slots),
                'available' => $available,
                'branch_full' => $slots !== [] && $available === 0,
                'no_sessions' => $slots === [],
            ],
            'suggestion' => $suggestion,
        ]);
    }

    public function days(Request $request): Response
    {
        $last = $this->lastBookableDate();
        $data = $this->validate($request, [
            'branch_id' => 'required|uuid',
            'scan_type_id' => 'required|uuid',
            'from' => 'nullable|date|after_or_equal:today|before_or_equal:' . $last,
            'days' => 'nullable|integer|min:1|max:31',
        ]);
        if ($this->branches->findActive($data['branch_id']) === null) {
            throw ValidationException::withField('branch_id', 'Choose one of our branches.');
        }
        $scan = $this->scanType($data['scan_type_id']);
        $from = $data['from'] ?? $this->clock->today();
        $to = (new \DateTimeImmutable($from))->modify('+' . (((int) ($data['days'] ?? 14)) - 1) . ' days')->format('Y-m-d');
        $to = min($to, $last);
        $rows = $this->slots->daySummary($data['branch_id'], (string) $scan['modality'], $from, $to, $this->clock->today(), $this->clock->time());
        $days = array_map(static fn (array $row): array => [
            'date' => (string) $row['slot_date'],
            'slot_count' => (int) $row['slot_count'],
            'remaining' => (int) $row['remaining'],
        ], $rows);
        return $this->ok(['from' => $from, 'to' => $to, 'days' => $days]);
    }

    public function nextAvailable(Request $request): Response
    {
        $data = $this->validate($request, [
            'scan_type_id' => 'required|uuid',
            'after' => 'nullable|date|before_or_equal:' . $this->lastBookableDate(),
            'exclude_branch_id' => 'nullable|uuid',
        ]);
        $scan = $this->scanType($data['scan_type_id']);
        $after = max($data['after'] ?? $this->clock->today(), $this->clock->today());
        return $this->ok([
            'suggestion' => $this->booking->nextAvailable((string) $scan['modality'], $after, $data['exclude_branch_id'] ?? null),
        ]);
    }

    public function checklist(Request $request): Response
    {
        $scan = $this->scanType((string) $request->param('id'));
        $items = array_map(static fn (array $item): array => [
            'id' => $item['id'],
            'code' => $item['code'],
            'question' => $item['question'],
            'help_text' => $item['help_text'],
            'answer_type' => $item['answer_type'],
            'is_required' => Model::flag($item['is_required']),
        ], $this->checklist->forScanType((string) $scan['id'], (string) $scan['modality']));
        return $this->ok([
            'scan_type' => [
                'id' => $scan['id'],
                'name' => $scan['name'],
                'slug' => $scan['slug'],
                'modality' => $scan['modality'],
                'preparation_tips' => $scan['preparation_tips'],
                'is_bookable_online' => Model::flag($scan['is_bookable_online']),
            ],
            'items' => $items,
        ]);
    }

    private function scanType(string $id): array
    {
        $scan = $this->scanTypes->findForBooking(strtolower($id));
        if ($scan === null) {
            throw new NotFoundException('Scan not found.');
        }
        return $scan;
    }

    private function lastBookableDate(): string
    {
        return $this->clock->now()->modify('+' . self::BOOKING_WINDOW_DAYS . ' days')->format('Y-m-d');
    }
}
