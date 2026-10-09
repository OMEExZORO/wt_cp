<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Controllers\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ConflictException;
use App\Exceptions\NotFoundException;
use App\Exceptions\ValidationException;
use App\Models\Model;
use App\Services\AuditLogger;
use PDOException;

abstract class AdminController extends Controller
{
    public const SLUG_PATTERN = '/^[a-z0-9]+(-[a-z0-9]+)*$/';
    public const HTTPS_URL_PATTERN = '/^https:\/\/[A-Za-z0-9][A-Za-z0-9.\-]*\.[A-Za-z]{2,}(?::\d{1,5})?(?:[\/?#][^\s<>"\'\\\\]*)?$/';

    public function __construct(protected readonly AuditLogger $audit)
    {
    }

    protected function partial(Request $request, array $rules): array
    {
        if ($request->method() !== 'PATCH') {
            return $rules;
        }
        $result = [];
        foreach ($rules as $field => $fieldRules) {
            $result[$field] = is_array($fieldRules) ? array_merge(['sometimes'], $fieldRules) : 'sometimes|' . $fieldRules;
        }
        return $result;
    }

    protected function pagination(Request $request): array
    {
        $page = $this->validate($request, ['page' => 'nullable|integer|min:1|max:100000', 'per_page' => 'nullable|integer|min:1|max:100']);
        $perPage = (int) ($page['per_page'] ?? 20);
        $number = (int) ($page['page'] ?? 1);
        return [$number, $perPage, ($number - 1) * $perPage];
    }

    protected function paged(string $key, array $items, int $total, int $page, int $perPage): Response
    {
        $pagination = ['page' => $page, 'per_page' => $perPage, 'total' => $total];
        return $this->ok([$key => $items, 'pagination' => $pagination], 200, $pagination);
    }

    protected function record(Request $request, string $action, string $entityType, string $entityId, array $metadata = []): void
    {
        $this->audit->log($action, $request, ['entity_type' => $entityType, 'entity_id' => $entityId, 'metadata' => $metadata]);
    }

    protected function changedFields(array $before, array $after): array
    {
        $changes = [];
        foreach ($after as $field => $value) {
            if (!array_key_exists($field, $before)) {
                continue;
            }
            $new = is_bool($value) ? ($value ? 't' : 'f') : (string) $value;
            $old = is_bool($before[$field]) ? ($before[$field] ? 't' : 'f') : (string) $before[$field];
            if ($old !== $new) {
                $changes[] = $field;
            }
        }
        return $changes;
    }

    protected function requireFound(?array $row, string $label): array
    {
        if ($row === null) {
            throw new NotFoundException($label . ' not found.');
        }
        return $row;
    }

    protected function runWrite(callable $write, string $conflictMessage): mixed
    {
        try {
            return $write();
        } catch (PDOException $e) {
            $state = (string) $e->getCode();
            if ($state === '23505') {
                throw new ConflictException($conflictMessage);
            }
            if ($state === '23503') {
                throw new ConflictException('This record is still in use. Deactivate it instead of deleting it.');
            }
            if ($state === '23514') {
                throw new ValidationException(['_' => 'One of the values is outside the allowed range.']);
            }
            throw $e;
        }
    }

    protected function createRecord(Request $request, Model $model, array $data, string $entity, string $conflict): array
    {
        $row = $this->runWrite(static fn (): array => $model->create($data), $conflict);
        $this->record($request, 'admin.' . $entity . '_created', $entity, (string) $row['id']);
        return $row;
    }

    protected function updateRecord(Request $request, Model $model, string $id, array $data, string $entity, string $label, string $conflict): array
    {
        $before = $this->requireFound($model->find($id), $label);
        $row = $this->runWrite(static fn (): ?array => $model->update($id, $data), $conflict);
        $row = $this->requireFound($row, $label);
        $this->record($request, 'admin.' . $entity . '_updated', $entity, $id, ['fields' => $this->changedFields($before, $data)]);
        return $row;
    }

    protected function deleteRecord(Request $request, Model $model, string $id, string $entity, string $label): Response
    {
        $before = $this->requireFound($model->find($id), $label);
        $this->runWrite(static fn (): bool => $model->delete($id), 'Conflict');
        $this->record($request, 'admin.' . $entity . '_deleted', $entity, $id, ['label' => (string) ($before['name'] ?? $before['question'] ?? $before['code'] ?? $id)]);
        return $this->noContent();
    }

    protected function uuidParam(Request $request, string $name = 'id'): string
    {
        return strtolower((string) $request->param($name));
    }
}
