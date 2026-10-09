<?php

declare(strict_types=1);

namespace App\Models;

final class Branch extends Model
{
    protected const TABLE = 'branches';
    protected const FILLABLE = [
        'slug', 'name', 'address_line', 'landmark', 'area', 'city', 'state', 'postal_code', 'phone', 'whatsapp',
        'email', 'opening_hours', 'maps_url', 'maps_embed_url', 'latitude', 'longitude', 'is_placeholder', 'is_active', 'sort_order',
    ];

    public function listActive(): array
    {
        return $this->fetchAll('SELECT * FROM branches WHERE is_active = TRUE ORDER BY sort_order, name');
    }

    public function findActive(string $id): ?array
    {
        return $this->fetchOne('SELECT * FROM branches WHERE id = :id AND is_active = TRUE', ['id' => $id]);
    }
}
