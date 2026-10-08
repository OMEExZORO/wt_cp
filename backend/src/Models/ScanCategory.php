<?php

declare(strict_types=1);

namespace App\Models;

final class ScanCategory extends Model
{
    protected const TABLE = 'scan_categories';
    protected const FILLABLE = ['parent_id', 'slug', 'modality', 'name', 'tagline', 'description', 'sort_order', 'is_active'];

    public function listActive(?string $modality): array
    {
        $sql = 'SELECT c.id, c.slug, c.modality, c.name, c.tagline, c.description, c.sort_order, p.slug AS parent_slug,
                       (SELECT COUNT(*) FROM scan_types t WHERE t.category_id = c.id AND t.is_active = TRUE) AS scan_count
                FROM scan_categories c
                LEFT JOIN scan_categories p ON p.id = c.parent_id
                WHERE c.is_active = TRUE';
        $params = [];
        if ($modality !== null) {
            $sql .= ' AND c.modality = :modality';
            $params['modality'] = $modality;
        }
        $sql .= ' ORDER BY c.modality, c.sort_order, c.name';
        return $this->fetchAll($sql, $params);
    }
}
