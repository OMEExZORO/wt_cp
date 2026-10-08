<?php

declare(strict_types=1);

namespace App\Models;

final class Referrer extends Model
{
    protected const TABLE = 'referrers';
    protected const FILLABLE = [
        'user_id', 'full_name', 'qualification', 'registration_number', 'clinic_name', 'phone', 'city',
        'verified_at', 'verified_by_user_id',
    ];

    public function findByUserId(string $userId): ?array
    {
        return $this->fetchOne('SELECT * FROM referrers WHERE user_id = :user_id', ['user_id' => $userId]);
    }

    public function syncContact(string $userId, string $fullName, ?string $phone): void
    {
        $this->execute(
            'UPDATE referrers SET full_name = :full_name, phone = :phone WHERE user_id = :user_id',
            ['full_name' => $fullName, 'phone' => $phone, 'user_id' => $userId]
        );
    }

    public static function toPublic(array $referrer): array
    {
        return [
            'referrer_id' => $referrer['id'],
            'qualification' => $referrer['qualification'] ?? null,
            'registration_number' => $referrer['registration_number'] ?? null,
            'clinic_name' => $referrer['clinic_name'] ?? null,
            'city' => $referrer['city'] ?? null,
            'is_verified' => !empty($referrer['verified_at']),
        ];
    }
}
