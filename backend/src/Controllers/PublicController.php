<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\NotFoundException;
use App\Models\Branch;
use App\Models\Faq;
use App\Models\Review;
use App\Models\ScanCategory;
use App\Models\ScanType;
use App\Models\SiteSetting;
use App\Services\PublicContentPresenter;

final class PublicController extends Controller
{
    public function __construct(
        private readonly Config $config,
        private readonly SiteSetting $settings,
        private readonly Branch $branches,
        private readonly ScanCategory $categories,
        private readonly ScanType $scanTypes,
        private readonly Faq $faqs,
        private readonly Review $reviews
    ) {
    }

    public function site(Request $request): Response
    {
        return $this->ok(['settings' => PublicContentPresenter::settings($this->settings->publicRows())]);
    }

    public function doctor(Request $request): Response
    {
        $settings = PublicContentPresenter::settings($this->settings->publicRows());
        return $this->ok(['doctor' => PublicContentPresenter::doctor($settings)]);
    }

    public function branches(Request $request): Response
    {
        $rows = array_map(PublicContentPresenter::branch(...), $this->branches->listActive());
        return $this->ok(['branches' => $rows]);
    }

    public function scanCategories(Request $request): Response
    {
        $filters = $this->validate($request, ['modality' => 'nullable|in:USG,CT,BIOPSY']);
        $rows = $this->categories->listActive($filters['modality'] ?? null);
        $items = array_map(static fn (array $row): array => [
            'id' => $row['id'],
            'slug' => $row['slug'],
            'modality' => $row['modality'],
            'name' => $row['name'],
            'tagline' => $row['tagline'],
            'description' => $row['description'],
            'parent_slug' => $row['parent_slug'],
            'scan_count' => (int) $row['scan_count'],
        ], $rows);
        return $this->ok(['categories' => $items]);
    }

    public function scanTypes(Request $request): Response
    {
        $filters = $this->validate($request, ['modality' => 'nullable|in:USG,CT,BIOPSY', 'q' => 'nullable|string|max:80']);
        $rows = $this->scanTypes->search($filters['modality'] ?? null, $filters['q'] ?? null);
        return $this->ok(
            ['scan_types' => array_map(PublicContentPresenter::scanType(...), $rows)],
            200,
            ['total' => count($rows)]
        );
    }

    public function scanType(Request $request): Response
    {
        $ref = (string) $request->param('ref');
        $isUuid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $ref) === 1;
        $row = $isUuid ? $this->scanTypes->findPublicById(strtolower($ref)) : $this->scanTypes->findPublicBySlug($ref);
        if ($row === null) {
            throw new NotFoundException('Scan not found.');
        }
        return $this->ok(['scan_type' => PublicContentPresenter::scanType($row)]);
    }

    public function faqs(Request $request): Response
    {
        $filters = $this->validate($request, [
            'category' => 'nullable|in:general,booking,preparation,reports,privacy',
            'limit' => 'nullable|integer|min:1|max:50',
        ]);
        $limit = isset($filters['limit']) ? (int) $filters['limit'] : null;
        return $this->ok(['faqs' => $this->faqs->listPublished($filters['category'] ?? null, $limit)]);
    }

    public function reviews(Request $request): Response
    {
        $filters = $this->validate($request, ['limit' => 'nullable|integer|min:1|max:50']);
        $limit = isset($filters['limit']) ? (int) $filters['limit'] : 12;
        $includeDemo = (string) $this->config->get('env') !== 'production';
        $rows = $this->reviews->listApproved($includeDemo, $limit);
        return $this->ok([
            'reviews' => array_map(static fn (array $row): array => PublicContentPresenter::review($row, $includeDemo), $rows),
            'summary' => PublicContentPresenter::reviewSummary($this->reviews->approvedStats($includeDemo)),
        ]);
    }
}
