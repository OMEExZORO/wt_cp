<?php

declare(strict_types=1);

namespace App\Models;

final class SiteSetting extends Model
{
    protected const TABLE = 'site_settings';
    protected const PRIMARY_KEY = 'key';
    protected const FILLABLE = ['value', 'is_placeholder', 'updated_by_user_id'];

    public function publicRows(): array
    {
        return $this->fetchAll(
            'SELECT key, value, value_type, group_name, label, is_placeholder FROM site_settings WHERE is_public = TRUE ORDER BY group_name, key'
        );
    }
}
