<?php

declare(strict_types=1);

namespace App\Models;

final class Patient extends Model
{
    protected const TABLE = 'patients';
    protected const FILLABLE = [
        'user_id', 'full_name', 'date_of_birth', 'gender', 'phone', 'email', 'address', 'city',
        'emergency_contact_name', 'emergency_contact_phone', 'consent_given_at', 'consent_version', 'created_by_user_id',
    ];

    public function findByUserId(string $userId): ?array
    {
        return $this->fetchOne('SELECT * FROM patients WHERE user_id = :user_id', ['user_id' => $userId]);
    }

    public function findWalkIn(string $fullName, string $phone): ?array
    {
        return $this->fetchOne(
            'SELECT * FROM patients WHERE phone = :phone AND lower(full_name) = lower(:full_name) ORDER BY created_at LIMIT 1',
            ['phone' => $phone, 'full_name' => $fullName]
        );
    }

    public function search(string $term, int $limit): array
    {
        $pattern = '%' . addcslashes(strtolower($term), '%_\\') . '%';
        return $this->fetchAll(
            'SELECT id, full_name, phone FROM patients WHERE lower(full_name) LIKE :pattern OR phone LIKE :pattern ORDER BY full_name, created_at LIMIT ' . max(1, min($limit, 25)),
            ['pattern' => $pattern]
        );
    }

    public function syncContact(string $userId, string $fullName, ?string $phone): void
    {
        $this->execute(
            'UPDATE patients SET full_name = :full_name, phone = :phone WHERE user_id = :user_id',
            ['full_name' => $fullName, 'phone' => $phone, 'user_id' => $userId]
        );
    }

    public static function toPublic(array $patient): array
    {
        return [
            'patient_id' => $patient['id'],
            'date_of_birth' => $patient['date_of_birth'] ?? null,
            'gender' => $patient['gender'] ?? null,
            'city' => $patient['city'] ?? null,
        ];
    }
}
