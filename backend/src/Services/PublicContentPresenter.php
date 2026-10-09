<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Model;

final class PublicContentPresenter
{
    public static function settings(array $rows): array
    {
        $settings = [];
        foreach ($rows as $row) {
            $placeholder = Model::flag($row['is_placeholder']);
            $type = (string) $row['value_type'];
            $empty = $placeholder || $row['value'] === null || $row['value'] === '';
            $settings[(string) $row['key']] = [
                'value' => $empty ? null : self::cast($type, (string) $row['value']),
                'type' => $type,
                'group' => (string) $row['group_name'],
                'label' => (string) $row['label'],
                'is_placeholder' => $placeholder,
            ];
        }
        return $settings;
    }

    public static function cast(string $type, string $value): mixed
    {
        if ($type === 'json') {
            $decoded = json_decode($value, true);
            return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }
        return $value;
    }

    public static function doctor(array $settings): array
    {
        $profile = [];
        foreach ($settings as $key => $setting) {
            if (str_starts_with($key, 'doctor.')) {
                $profile[substr($key, 7)] = $setting;
            }
        }
        return $profile;
    }

    public static function branch(array $row): array
    {
        $text = static fn (mixed $value): ?string => $value === null || $value === '' ? null : (string) $value;
        $address = (string) $row['address_line'];
        return [
            'id' => $row['id'],
            'slug' => $row['slug'],
            'name' => $row['name'],
            'address_line' => $address,
            'landmark' => $text($row['landmark']),
            'area' => $text($row['area']),
            'city' => $row['city'],
            'state' => $row['state'],
            'postal_code' => $text($row['postal_code']),
            'phone' => $text($row['phone']),
            'whatsapp' => $text($row['whatsapp']),
            'email' => $text($row['email']),
            'opening_hours' => $text($row['opening_hours']),
            'maps_url' => $text($row['maps_url']),
            'maps_embed_url' => $text($row['maps_embed_url']),
            'latitude' => $row['latitude'] === null ? null : (float) $row['latitude'],
            'longitude' => $row['longitude'] === null ? null : (float) $row['longitude'],
            'address_is_placeholder' => str_starts_with($address, 'TODO'),
            'is_placeholder' => Model::flag($row['is_placeholder']),
        ];
    }

    public static function scanType(array $row): array
    {
        return [
            'id' => $row['id'],
            'slug' => $row['slug'],
            'modality' => $row['modality'],
            'name' => $row['name'],
            'short_description' => $row['short_description'],
            'preparation_tips' => $row['preparation_tips'],
            'is_bookable_online' => Model::flag($row['is_bookable_online']),
            'category' => ['slug' => $row['category_slug'], 'name' => $row['category_name']],
            'group' => $row['group_slug'] === null ? null : ['slug' => $row['group_slug'], 'name' => $row['group_name']],
        ];
    }

    public static function review(array $row, bool $exposeDemoFlag): array
    {
        $review = [
            'id' => $row['id'],
            'display_name' => $row['display_name'],
            'rating' => (int) $row['rating'],
            'body' => $row['body'],
            'verified_visit' => Model::flag($row['verified_visit']),
            'created_at' => Model::iso($row['created_at']),
            'source' => $row['source'] ?? 'site',
            'source_url' => $row['source_url'] ?? null,
            'external_review_date' => $row['external_review_date'] ?? null,
            'translated_by_google' => (bool) ($row['translated_by_google'] ?? false),
            'reviewer_photo_url' => $row['reviewer_photo_url'] ?? null,
        ];
        if ($exposeDemoFlag) {
            $review['is_demo'] = Model::flag($row['is_demo']);
        }
        return $review;
    }

    public static function reviewSummary(array $stats): array
    {
        $count = (int) $stats['review_count'];
        return [
            'count' => $count,
            'average_rating' => $count === 0 || $stats['average_rating'] === null ? null : round((float) $stats['average_rating'], 1),
        ];
    }
}
