<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Models\Model;
use App\Models\Review;
use App\Services\AuditLogger;

final class ReviewAdminController extends AdminController
{
    public function __construct(AuditLogger $audit, private readonly Review $reviews, private readonly AdminRepository $repository)
    {
        parent::__construct($audit);
    }

    public function index(Request $request): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request);
        $filters = $this->validate($request, ['status' => 'nullable|in:pending,approved,rejected']);
        $status = $filters['status'] ?? null;
        $rows = array_map($this->present(...), $this->repository->reviews($status, $perPage, $offset));
        return $this->paged('reviews', $rows, $this->repository->reviewCount($status), $page, $perPage);
    }

    public function store(Request $request): Response
    {
        $actor = $this->user($request);
        $data = $this->validate($request, $this->googleRules());
        $row = $this->runWrite(fn (): array => $this->reviews->create($this->googleAttributes($data) + [
            'status' => 'approved',
            'verified_visit' => false,
            'is_demo' => false,
            'moderated_by_user_id' => $actor['id'],
            'moderated_at' => date('Y-m-d H:i:sP'),
        ]), 'This review could not be saved.');
        $this->record($request, 'admin.review_created', 'review', (string) $row['id'], ['source' => 'google']);
        return $this->created($this->present($row));
    }

    public function update(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $data = $this->validate($request, $this->googleRules());
        $before = $this->requireFound($this->reviews->find($id), 'Review');
        if (($before['source'] ?? 'site') !== 'google') {
            throw new ValidationException(['_' => 'Only reviews entered from Google can be edited.']);
        }
        $row = $this->requireFound($this->runWrite(fn (): ?array => $this->reviews->update($id, $this->googleAttributes($data)), 'This review could not be saved.'), 'Review');
        $this->record($request, 'admin.review_updated', 'review', $id, ['fields' => $this->changedFields($before, $this->googleAttributes($data))]);
        return $this->ok($this->present($row));
    }

    public function moderate(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $actor = $this->user($request);
        $data = $this->validate($request, [
            'status' => 'required|in:pending,approved,rejected',
            'moderation_note' => 'nullable|text|max:500',
        ]);
        $before = $this->requireFound($this->reviews->find($id), 'Review');
        $row = $this->requireFound($this->reviews->update($id, [
            'status' => $data['status'],
            'moderation_note' => $data['moderation_note'] ?? null,
            'moderated_by_user_id' => $actor['id'],
            'moderated_at' => $data['status'] === 'pending' ? null : date('Y-m-d H:i:sP'),
        ]), 'Review');
        $this->record($request, 'admin.review_' . $data['status'], 'review', $id, ['from' => $before['status']]);
        return $this->ok($this->present($row));
    }

    private function googleRules(): array
    {
        return [
            'display_name' => 'required|min:1|max:80',
            'rating' => 'required|integer|min:1|max:5',
            'body' => 'required|text|min:10|max:2000',
            'external_review_date' => 'required|date|after:2000-01-01|before_or_equal:today',
            'source_url' => ['nullable', 'max:500', 'regex:' . self::HTTPS_URL_PATTERN],
            'reviewer_photo_url' => ['nullable', 'max:500', 'regex:' . self::HTTPS_URL_PATTERN],
        ];
    }

    private function googleAttributes(array $data): array
    {
        return [
            'display_name' => $data['display_name'],
            'rating' => (int) $data['rating'],
            'body' => $data['body'],
            'external_review_date' => $data['external_review_date'],
            'source_url' => $data['source_url'] ?? null,
            'reviewer_photo_url' => $data['reviewer_photo_url'] ?? null,
            'source' => 'google',
        ];
    }

    private function present(array $row): array
    {
        return [
            'id' => $row['id'],
            'display_name' => $row['display_name'],
            'rating' => (int) $row['rating'],
            'body' => $row['body'],
            'status' => $row['status'],
            'verified_visit' => Model::flag($row['verified_visit']),
            'is_demo' => Model::flag($row['is_demo']),
            'source' => $row['source'] ?? 'site',
            'source_url' => $row['source_url'] ?? null,
            'external_review_date' => $row['external_review_date'] ?? null,
            'reviewer_photo_url' => $row['reviewer_photo_url'] ?? null,
            'moderation_note' => $row['moderation_note'] ?? null,
            'moderated_at' => Model::iso($row['moderated_at'] ?? null),
            'created_at' => Model::iso($row['created_at'] ?? null),
        ];
    }
}
