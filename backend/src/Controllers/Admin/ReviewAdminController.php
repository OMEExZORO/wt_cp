<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
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
            'moderation_note' => $row['moderation_note'] ?? null,
            'moderated_at' => Model::iso($row['moderated_at'] ?? null),
            'created_at' => Model::iso($row['created_at'] ?? null),
        ];
    }
}
