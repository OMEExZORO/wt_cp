<?php

declare(strict_types=1);

namespace App\Models;

final class Faq extends Model
{
    protected const TABLE = 'faqs';
    protected const FILLABLE = ['question', 'answer', 'category', 'sort_order', 'is_published'];

    public function listPublished(?string $category, ?int $limit): array
    {
        $sql = 'SELECT id, question, answer, category, sort_order FROM faqs WHERE is_published = TRUE';
        $params = [];
        if ($category !== null) {
            $sql .= ' AND category = :category';
            $params['category'] = $category;
        }
        $sql .= ' ORDER BY sort_order, question';
        if ($limit !== null) {
            $sql .= ' LIMIT ' . max(1, min(100, $limit));
        }
        return $this->fetchAll($sql, $params);
    }
}
