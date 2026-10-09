<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Models\Branch;
use App\Models\Model;
use App\Services\AuditLogger;

final class BranchAdminController extends AdminController
{
    public function __construct(AuditLogger $audit, private readonly Branch $branches, private readonly AdminRepository $repository)
    {
        parent::__construct($audit);
    }

    public function index(Request $request): Response
    {
        return $this->ok(['branches' => array_map($this->present(...), $this->repository->branches())]);
    }

    public function store(Request $request): Response
    {
        $data = $this->prepare($this->validate($request, $this->rules()));
        $row = $this->createRecord($request, $this->branches, $data, 'branch', 'A branch with this slug already exists.');
        return $this->created($this->present($row));
    }

    public function update(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $data = $this->validate($request, $this->partial($request, $this->rules()));
        $existing = $this->requireFound($this->branches->find($id), 'Branch');
        $data = $this->prepare($data, $existing);
        $row = $this->updateRecord($request, $this->branches, $id, $data, 'branch', 'Branch', 'A branch with this slug already exists.');
        return $this->ok($this->present($row));
    }

    public function destroy(Request $request): Response
    {
        return $this->deleteRecord($request, $this->branches, $this->uuidParam($request), 'branch', 'Branch');
    }

    private function rules(): array
    {
        return [
            'slug' => ['required', 'max:60', 'regex:' . self::SLUG_PATTERN],
            'name' => 'required|min:2|max:120',
            'address_line' => 'required|min:3|max:255',
            'landmark' => 'nullable|max:160',
            'area' => 'nullable|max:120',
            'city' => 'required|min:2|max:80',
            'state' => 'required|min:2|max:80',
            'postal_code' => ['nullable', 'regex:/^[1-9]\d{5}$/'],
            'phone' => 'nullable|phone',
            'whatsapp' => 'nullable|phone',
            'email' => 'nullable|email',
            'opening_hours' => 'nullable|text|max:500',
            'maps_url' => ['nullable', 'max:500', 'regex:' . self::HTTPS_URL_PATTERN],
            'maps_embed_url' => ['nullable', 'max:800', 'regex:' . self::HTTPS_URL_PATTERN],
            'latitude' => ['nullable', 'regex:/^-?\d{1,2}(\.\d{1,6})?$/'],
            'longitude' => ['nullable', 'regex:/^-?\d{1,3}(\.\d{1,6})?$/'],
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0|max:1000',
        ];
    }

    private function prepare(array $data, ?array $existing = null): array
    {
        if (isset($data['latitude']) && abs((float) $data['latitude']) > 90) {
            throw ValidationException::withField('latitude', 'Latitude must be between -90 and 90.');
        }
        if (isset($data['longitude']) && abs((float) $data['longitude']) > 180) {
            throw ValidationException::withField('longitude', 'Longitude must be between -180 and 180.');
        }
        $address = (string) ($data['address_line'] ?? $existing['address_line'] ?? '');
        $data['is_placeholder'] = str_starts_with($address, 'TODO');
        return $data;
    }

    private function present(array $row): array
    {
        return [
            'id' => $row['id'],
            'slug' => $row['slug'],
            'name' => $row['name'],
            'address_line' => $row['address_line'],
            'landmark' => $row['landmark'],
            'area' => $row['area'],
            'city' => $row['city'],
            'state' => $row['state'],
            'postal_code' => $row['postal_code'],
            'phone' => $row['phone'],
            'whatsapp' => $row['whatsapp'],
            'email' => $row['email'],
            'opening_hours' => $row['opening_hours'],
            'maps_url' => $row['maps_url'],
            'maps_embed_url' => $row['maps_embed_url'],
            'latitude' => $row['latitude'] === null ? null : (float) $row['latitude'],
            'longitude' => $row['longitude'] === null ? null : (float) $row['longitude'],
            'is_placeholder' => Model::flag($row['is_placeholder']),
            'is_active' => Model::flag($row['is_active']),
            'sort_order' => (int) $row['sort_order'],
        ];
    }
}
