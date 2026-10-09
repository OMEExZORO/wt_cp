<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Models\AdminRepository;
use App\Models\Faq;
use App\Models\Model;
use App\Services\AuditLogger;

final class FaqAdminController extends AdminController
{
    public function __construct(AuditLogger $audit, private readonly Faq $faqs, private readonly AdminRepository $repository)
    {
        parent::__construct($audit);
    }

    public function index(Request $request): Response
    {
        return $this->ok(['faqs' => array_map($this->present(...), $this->repository->faqs())]);
    }

    public function store(Request $request): Response
    {
        $data = $this->validate($request, $this->rules());
        $row = $this->createRecord($request, $this->faqs, $data, 'faq', 'A FAQ with this question already exists.');
        return $this->created($this->present($row));
    }

    public function update(Request $request): Response
    {
        $data = $this->validate($request, $this->partial($request, $this->rules()));
        $row = $this->updateRecord($request, $this->faqs, $this->uuidParam($request), $data, 'faq', 'FAQ', 'A FAQ with this question already exists.');
        return $this->ok($this->present($row));
    }

    public function destroy(Request $request): Response
    {
        return $this->deleteRecord($request, $this->faqs, $this->uuidParam($request), 'faq', 'FAQ');
    }

    private function rules(): array
    {
        return [
            'question' => 'required|min:5|max:300',
            'answer' => 'required|text|min:5|max:2000',
            'category' => 'required|in:general,booking,preparation,reports,privacy',
            'sort_order' => 'integer|min:0|max:1000',
            'is_published' => 'boolean',
        ];
    }

    private function present(array $row): array
    {
        return [
            'id' => $row['id'],
            'question' => $row['question'],
            'answer' => $row['answer'],
            'category' => $row['category'],
            'sort_order' => (int) $row['sort_order'],
            'is_published' => Model::flag($row['is_published']),
        ];
    }
}
