<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Exceptions\NotFoundException;
use App\Exceptions\ValidationException;

final class ReviewPolicy
{
    public static function assertEligible(?array $appointment, string $userId, bool $alreadyReviewed): void
    {
        if ($appointment === null || (string) ($appointment['patient_user_id'] ?? '') !== $userId) {
            throw new NotFoundException('Appointment not found.');
        }
        if (($appointment['status'] ?? null) !== 'completed') {
            throw ValidationException::withField('appointment_id', 'You can review a visit once it has been completed.');
        }
        if ($alreadyReviewed) {
            throw new ConflictException('You have already reviewed this visit.');
        }
    }

    public static function defaultDisplayName(string $fullName): string
    {
        $parts = preg_split('/\s+/u', trim($fullName), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if ($parts === []) {
            return 'Patient';
        }
        if (count($parts) === 1) {
            return $parts[0];
        }
        return $parts[0] . ' ' . mb_strtoupper(mb_substr((string) end($parts), 0, 1)) . '.';
    }
}
