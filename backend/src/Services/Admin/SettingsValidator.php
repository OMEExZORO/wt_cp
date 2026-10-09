<?php

declare(strict_types=1);

namespace App\Services\Admin;

use App\Controllers\Admin\AdminController;

final class SettingsValidator
{
    public const NON_CLEARABLE = [
        'clinic.name', 'clinic.short_name', 'clinic.logo_tagline',
        'doctor.name', 'doctor.qualifications', 'doctor.title', 'doctor.affiliation',
        'alerts.escalation_minutes',
    ];

    public const READ_ONLY_GROUPS = ['legal'];
    public const READ_ONLY_TYPES = ['json', 'image'];

    public static function isEditable(array $row): bool
    {
        return !in_array((string) $row['group_name'], self::READ_ONLY_GROUPS, true)
            && !in_array((string) $row['value_type'], self::READ_ONLY_TYPES, true);
    }

    public static function rulesFor(array $row): array
    {
        $key = (string) $row['key'];
        $required = in_array($key, self::NON_CLEARABLE, true);
        $presence = $required ? ['required'] : ['nullable'];
        if ($key === 'alerts.escalation_minutes') {
            return array_merge($presence, ['integer', 'min:1', 'max:1440']);
        }
        return match ((string) $row['value_type']) {
            'phone' => array_merge($presence, ['phone']),
            'email' => array_merge($presence, ['email']),
            'url' => array_merge($presence, ['max:500', 'regex:' . AdminController::HTTPS_URL_PATTERN]),
            'text' => array_merge($presence, ['text', 'max:2000']),
            default => array_merge($presence, ['string', 'max:255']),
        };
    }

    public static function buildRules(array $rowsByKey): array
    {
        $rules = [];
        foreach ($rowsByKey as $key => $row) {
            $rules[$key] = self::rulesFor($row);
        }
        return $rules;
    }
}
