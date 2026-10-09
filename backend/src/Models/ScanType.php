<?php

declare(strict_types=1);

namespace App\Models;

final class ScanType extends Model
{
    protected const TABLE = 'scan_types';
    protected const FILLABLE = [
        'category_id', 'slug', 'modality', 'name', 'short_description', 'preparation_tips',
        'duration_minutes', 'fee_inr', 'is_bookable_online', 'is_active', 'sort_order',
    ];

    private const SELECT = 'SELECT t.id, t.slug, t.modality, t.name, t.short_description, t.preparation_tips, t.is_bookable_online, t.sort_order,
                   c.slug AS category_slug, c.name AS category_name, p.slug AS group_slug, p.name AS group_name
            FROM scan_types t
            JOIN scan_categories c ON c.id = t.category_id
            LEFT JOIN scan_categories p ON p.id = c.parent_id';

    public function search(?string $modality, ?string $query): array
    {
        $sql = self::SELECT . ' WHERE t.is_active = TRUE AND c.is_active = TRUE';
        $params = [];
        if ($modality !== null) {
            $sql .= ' AND t.modality = :modality';
            $params['modality'] = $modality;
        }
        if ($query !== null && $query !== '') {
            $sql .= ' AND (t.name ILIKE :q OR t.short_description ILIKE :q OR c.name ILIKE :q)';
            $params['q'] = '%' . self::escapeLike($query) . '%';
        }
        $sql .= ' ORDER BY t.modality, c.sort_order, t.sort_order, t.name';
        return $this->fetchAll($sql, $params);
    }

    public function findPublicBySlug(string $slug): ?array
    {
        return $this->fetchOne(self::SELECT . ' WHERE t.is_active = TRUE AND t.slug = :slug', ['slug' => $slug]);
    }

    public function findPublicById(string $id): ?array
    {
        return $this->fetchOne(self::SELECT . ' WHERE t.is_active = TRUE AND t.id = :id', ['id' => $id]);
    }

    public function findForBooking(string $id): ?array
    {
        return $this->fetchOne(
            'SELECT t.id, t.slug, t.modality, t.name, t.preparation_tips, t.duration_minutes, t.is_bookable_online
             FROM scan_types t JOIN scan_categories c ON c.id = t.category_id
             WHERE t.id = :id AND t.is_active = TRUE AND c.is_active = TRUE',
            ['id' => $id]
        );
    }

    public static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
