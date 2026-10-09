<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Models\ChecklistItem;
use App\Models\Model;
use App\Models\ScanCategory;
use App\Models\ScanType;
use App\Services\AuditLogger;

final class CatalogAdminController extends AdminController
{
    public const MODALITIES = 'USG,CT,BIOPSY';
    public const ANSWER_TYPES = 'yes_no,yes_no_unsure,text,date';
    public const ATTENTION_VALUES = ['yes', 'no', 'unsure'];

    public function __construct(
        AuditLogger $audit,
        private readonly ScanCategory $categories,
        private readonly ScanType $scanTypes,
        private readonly ChecklistItem $checklistItems,
        private readonly AdminRepository $repository
    ) {
        parent::__construct($audit);
    }

    public function categoryIndex(Request $request): Response
    {
        $rows = array_map($this->presentCategory(...), $this->repository->categories());
        return $this->ok(['categories' => $rows]);
    }

    public function categoryStore(Request $request): Response
    {
        $data = $this->validate($request, $this->categoryRules());
        $row = $this->createRecord($request, $this->categories, $data, 'scan_category', 'A category with this slug already exists.');
        return $this->created($this->presentCategory($row));
    }

    public function categoryUpdate(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $data = $this->validate($request, $this->partial($request, $this->categoryRules()));
        if (isset($data['parent_id']) && $data['parent_id'] === $id) {
            throw ValidationException::withField('parent_id', 'A category cannot be its own parent.');
        }
        $row = $this->updateRecord($request, $this->categories, $id, $data, 'scan_category', 'Category', 'A category with this slug already exists.');
        return $this->ok($this->presentCategory($row));
    }

    public function categoryDestroy(Request $request): Response
    {
        return $this->deleteRecord($request, $this->categories, $this->uuidParam($request), 'scan_category', 'Category');
    }

    public function typeIndex(Request $request): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request);
        $filters = $this->validate($request, [
            'modality' => 'nullable|in:' . self::MODALITIES,
            'category_id' => 'nullable|uuid',
            'q' => 'nullable|string|max:80',
        ]);
        $filters = array_filter($filters, static fn (mixed $value): bool => $value !== null);
        $rows = array_map($this->presentType(...), $this->repository->scanTypes($filters, $perPage, $offset));
        return $this->paged('scan_types', $rows, $this->repository->scanTypeCount($filters), $page, $perPage);
    }

    public function typeStore(Request $request): Response
    {
        $data = $this->validate($request, $this->typeRules());
        $this->assertModalityMatchesCategory((string) $data['category_id'], (string) $data['modality']);
        $row = $this->createRecord($request, $this->scanTypes, $data, 'scan_type', 'A scan with this slug already exists.');
        return $this->created($this->presentType($row));
    }

    public function typeUpdate(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $data = $this->validate($request, $this->partial($request, $this->typeRules()));
        $existing = $this->requireFound($this->scanTypes->find($id), 'Scan type');
        $this->assertModalityMatchesCategory((string) ($data['category_id'] ?? $existing['category_id']), (string) ($data['modality'] ?? $existing['modality']));
        $row = $this->updateRecord($request, $this->scanTypes, $id, $data, 'scan_type', 'Scan type', 'A scan with this slug already exists.');
        return $this->ok($this->presentType($row));
    }

    public function typeDestroy(Request $request): Response
    {
        return $this->deleteRecord($request, $this->scanTypes, $this->uuidParam($request), 'scan_type', 'Scan type');
    }

    public function checklistIndex(Request $request): Response
    {
        $filters = $this->validate($request, ['scan_type_id' => 'nullable|uuid', 'modality' => 'nullable|in:' . self::MODALITIES]);
        $filters = array_filter($filters, static fn (mixed $value): bool => $value !== null);
        return $this->ok(['items' => array_map($this->presentItem(...), $this->repository->checklistItems($filters))]);
    }

    public function checklistStore(Request $request): Response
    {
        $data = $this->checklistPayload($request, $this->validate($request, $this->checklistRules()));
        $row = $this->runWrite(fn (): array => $this->repository->insertChecklistItem($data), 'A checklist item with this code already exists.');
        $this->record($request, 'admin.checklist_item_created', 'checklist_item', (string) $row['id']);
        return $this->created($this->presentItem($row));
    }

    public function checklistUpdate(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $existing = $this->requireFound($this->repository->checklistItem($id), 'Checklist item');
        $data = $this->validate($request, $this->partial($request, $this->checklistRules()));
        $merged = $this->mergeChecklist($existing, $data, $request);
        $payload = $this->checklistPayload($request, $merged);
        $row = $this->runWrite(fn (): ?array => $this->repository->updateChecklistItem($id, $payload), 'A checklist item with this code already exists.');
        $row = $this->requireFound($row, 'Checklist item');
        $this->record($request, 'admin.checklist_item_updated', 'checklist_item', $id, ['fields' => array_keys($data)]);
        return $this->ok($this->presentItem($row));
    }

    public function checklistDestroy(Request $request): Response
    {
        return $this->deleteRecord($request, $this->checklistItems, $this->uuidParam($request), 'checklist_item', 'Checklist item');
    }

    public static function parseAttentionAnswers(mixed $raw, string $answerType): array
    {
        if ($raw === null || $raw === []) {
            return [];
        }
        if (!is_array($raw) || !array_is_list($raw) || count($raw) > 3) {
            throw ValidationException::withField('attention_answers', 'Provide up to three answers as a list.');
        }
        if (!in_array($answerType, ['yes_no', 'yes_no_unsure'], true)) {
            throw ValidationException::withField('attention_answers', 'Attention answers apply only to yes or no questions.');
        }
        $allowed = $answerType === 'yes_no' ? ['yes', 'no'] : self::ATTENTION_VALUES;
        $clean = [];
        foreach ($raw as $value) {
            if (!is_string($value) || !in_array($value, $allowed, true)) {
                throw ValidationException::withField('attention_answers', 'Use only ' . implode(', ', $allowed) . '.');
            }
            $clean[$value] = $value;
        }
        return array_values($clean);
    }

    private function categoryRules(): array
    {
        return [
            'parent_id' => 'nullable|uuid',
            'slug' => ['required', 'max:80', 'regex:' . self::SLUG_PATTERN],
            'modality' => 'required|in:' . self::MODALITIES,
            'name' => 'required|min:2|max:120',
            'tagline' => 'nullable|max:160',
            'description' => 'nullable|text|max:1000',
            'sort_order' => 'integer|min:0|max:1000',
            'is_active' => 'boolean',
        ];
    }

    private function typeRules(): array
    {
        return [
            'category_id' => 'required|uuid',
            'slug' => ['required', 'max:80', 'regex:' . self::SLUG_PATTERN],
            'modality' => 'required|in:' . self::MODALITIES,
            'name' => 'required|min:2|max:120',
            'short_description' => 'required|text|min:5|max:600',
            'preparation_tips' => 'required|text|min:5|max:2000',
            'duration_minutes' => 'integer|min:5|max:240',
            'fee_inr' => ['nullable', 'regex:/^\d{1,8}(\.\d{1,2})?$/'],
            'is_bookable_online' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0|max:1000',
        ];
    }

    private function checklistRules(): array
    {
        return [
            'scan_type_id' => 'nullable|uuid',
            'modality' => 'nullable|in:' . self::MODALITIES,
            'code' => ['required', 'max:80', 'regex:/^[a-z0-9]+(_[a-z0-9]+)*$/'],
            'question' => 'required|min:5|max:300',
            'help_text' => 'nullable|text|max:500',
            'answer_type' => 'required|in:' . self::ANSWER_TYPES,
            'is_required' => 'boolean',
            'sort_order' => 'integer|min:0|max:1000',
            'is_active' => 'boolean',
        ];
    }

    private function mergeChecklist(array $existing, array $data, Request $request): array
    {
        if ($request->method() !== 'PATCH') {
            return $data;
        }
        $existing['attention_answers'] = $this->decodeArray($existing['attention_answers']);
        if (array_key_exists('scan_type_id', $data) && $data['scan_type_id'] !== null && !array_key_exists('modality', $data)) {
            $data['modality'] = null;
        }
        if (array_key_exists('modality', $data) && $data['modality'] !== null && !array_key_exists('scan_type_id', $data)) {
            $data['scan_type_id'] = null;
        }
        return array_merge($existing, $data);
    }

    private function checklistPayload(Request $request, array $data): array
    {
        $scanTypeId = $data['scan_type_id'] ?? null;
        $modality = $data['modality'] ?? null;
        if (($scanTypeId === null) === ($modality === null)) {
            throw ValidationException::withField('scan_type_id', 'Choose either one scan type or a whole modality.');
        }
        $body = $request->body();
        $raw = array_key_exists('attention_answers', $body) ? $body['attention_answers'] : ($data['attention_answers'] ?? []);
        if (!array_key_exists('attention_answers', $body) && !in_array($data['answer_type'], ['yes_no', 'yes_no_unsure'], true)) {
            $raw = [];
        }
        $answers = self::parseAttentionAnswers($raw, (string) $data['answer_type']);
        return [
            'scan_type_id' => $scanTypeId,
            'modality' => $modality,
            'code' => $data['code'],
            'question' => $data['question'],
            'help_text' => $data['help_text'] ?? null,
            'answer_type' => $data['answer_type'],
            'is_required' => (bool) ($data['is_required'] ?? true),
            'attention_answers' => '{' . implode(',', $answers) . '}',
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_active' => (bool) ($data['is_active'] ?? true),
        ];
    }

    private function assertModalityMatchesCategory(string $categoryId, string $modality): void
    {
        $category = $this->categories->find($categoryId);
        if ($category === null) {
            throw ValidationException::withField('category_id', 'Choose an existing category.');
        }
        if ($category['modality'] !== $modality) {
            throw ValidationException::withField('modality', 'The scan modality must match its category.');
        }
    }

    private function decodeArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        $text = trim((string) $value, '{}');
        return $text === '' ? [] : explode(',', $text);
    }

    private function presentCategory(array $row): array
    {
        return [
            'id' => $row['id'],
            'parent_id' => $row['parent_id'],
            'parent_name' => $row['parent_name'] ?? null,
            'slug' => $row['slug'],
            'modality' => $row['modality'],
            'name' => $row['name'],
            'tagline' => $row['tagline'],
            'description' => $row['description'],
            'sort_order' => (int) $row['sort_order'],
            'is_active' => Model::flag($row['is_active']),
        ];
    }

    private function presentType(array $row): array
    {
        return [
            'id' => $row['id'],
            'category_id' => $row['category_id'],
            'category_name' => $row['category_name'] ?? null,
            'slug' => $row['slug'],
            'modality' => $row['modality'],
            'name' => $row['name'],
            'short_description' => $row['short_description'],
            'preparation_tips' => $row['preparation_tips'],
            'duration_minutes' => (int) $row['duration_minutes'],
            'fee_inr' => $row['fee_inr'] === null ? null : (float) $row['fee_inr'],
            'is_bookable_online' => Model::flag($row['is_bookable_online']),
            'is_active' => Model::flag($row['is_active']),
            'sort_order' => (int) $row['sort_order'],
        ];
    }

    private function presentItem(array $row): array
    {
        return [
            'id' => $row['id'],
            'scan_type_id' => $row['scan_type_id'],
            'scan_type_name' => $row['scan_type_name'] ?? null,
            'modality' => $row['modality'],
            'code' => $row['code'],
            'question' => $row['question'],
            'help_text' => $row['help_text'],
            'answer_type' => $row['answer_type'],
            'is_required' => Model::flag($row['is_required']),
            'attention_answers' => $this->decodeArray($row['attention_answers']),
            'sort_order' => (int) $row['sort_order'],
            'is_active' => Model::flag($row['is_active']),
        ];
    }
}
