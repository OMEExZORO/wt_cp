<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Models\Model;
use App\Services\Admin\SettingsValidator;
use App\Services\AuditLogger;

final class SettingsAdminController extends AdminController
{
    public const MAX_KEYS = 40;

    public function __construct(AuditLogger $audit, private readonly AdminRepository $repository)
    {
        parent::__construct($audit);
    }

    public function index(Request $request): Response
    {
        $rows = array_map(static fn (array $row): array => [
            'key' => $row['key'],
            'value' => $row['value'],
            'type' => $row['value_type'],
            'group' => $row['group_name'],
            'label' => $row['label'],
            'is_public' => Model::flag($row['is_public']),
            'is_placeholder' => Model::flag($row['is_placeholder']),
            'is_editable' => SettingsValidator::isEditable($row),
            'is_required' => in_array((string) $row['key'], SettingsValidator::NON_CLEARABLE, true),
            'updated_at' => Model::iso($row['updated_at']),
        ], $this->repository->settings());
        return $this->ok(['settings' => $rows]);
    }

    public function update(Request $request): Response
    {
        $submitted = $request->body()['settings'] ?? null;
        if (!is_array($submitted) || $submitted === [] || array_is_list($submitted) || count($submitted) > self::MAX_KEYS) {
            throw new ValidationException(['settings' => 'Send an object of setting keys and values.']);
        }
        foreach ($submitted as $key => $value) {
            if (!is_string($key) || !is_scalar($value) && $value !== null) {
                throw new ValidationException(['settings' => 'Every setting must be a single value.']);
            }
        }

        $actor = $this->user($request);
        $changes = $this->repository->transaction(function () use ($submitted, $actor, $request): array {
            $rows = $this->repository->settingsByKeys(array_map('strval', array_keys($submitted)));
            $errors = [];
            foreach (array_keys($submitted) as $key) {
                if (!isset($rows[$key])) {
                    $errors[(string) $key] = 'Unknown setting.';
                } elseif (!SettingsValidator::isEditable($rows[$key])) {
                    $errors[(string) $key] = 'This setting cannot be edited here.';
                }
            }
            if ($errors !== []) {
                throw new ValidationException($errors);
            }

            $clean = $this->validate($request, SettingsValidator::buildRules($rows), [], $submitted);
            $changes = [];
            foreach ($clean as $key => $value) {
                $row = $rows[$key];
                $text = $value === null ? null : (string) $value;
                $this->repository->writeSetting($key, $text, $text === null, (string) $actor['id']);
                if ((string) $row['value'] !== (string) $text || Model::flag($row['is_placeholder']) !== ($text === null)) {
                    $changes[$key] = ['from' => $this->shorten($row['value']), 'to' => $this->shorten($text)];
                }
            }
            return $changes;
        });

        $this->record($request, 'admin.settings_updated', 'site_settings', 'bulk', ['changes' => $changes]);
        return $this->index($request);
    }

    private function shorten(?string $value): ?string
    {
        return $value === null ? null : mb_substr($value, 0, 200);
    }
}
