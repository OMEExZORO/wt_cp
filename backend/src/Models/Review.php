<?php

declare(strict_types=1);

namespace App\Models;

final class Review extends Model
{
    protected const TABLE = 'reviews';
    protected const FILLABLE = [
        'patient_id', 'appointment_id', 'display_name', 'rating', 'body', 'status', 'verified_visit', 'is_demo',
        'moderated_by_user_id', 'moderated_at', 'moderation_note', 'source', 'source_url', 'external_review_date', 'reviewer_photo_url',
    ];

    public function listApproved(bool $includeDemo, int $limit): array
    {
        $sql = "SELECT id, display_name, rating, body, verified_visit, is_demo, created_at, source, source_url, external_review_date, reviewer_photo_url FROM reviews WHERE status = 'approved'";
        if (!$includeDemo) {
            $sql .= ' AND is_demo = FALSE';
        }
        $sql .= ' ORDER BY COALESCE(external_review_date::timestamptz, created_at) DESC LIMIT ' . max(1, min(50, $limit));
        return $this->fetchAll($sql);
    }

    public function approvedStats(bool $includeDemo): array
    {
        $sql = "SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating FROM reviews WHERE status = 'approved'";
        if (!$includeDemo) {
            $sql .= ' AND is_demo = FALSE';
        }
        return $this->fetchOne($sql) ?? ['review_count' => 0, 'average_rating' => null];
    }
}
