<?php

declare(strict_types=1);

namespace App\Models;

final class ReviewRepository extends Model
{
    public function appointmentForReview(string $appointmentId): ?array
    {
        return $this->fetchOne(
            'SELECT a.id, a.status, a.patient_id, p.user_id AS patient_user_id
             FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = :id',
            ['id' => $appointmentId]
        );
    }

    public function existsForAppointment(string $appointmentId): bool
    {
        return (bool) $this->fetchValue('SELECT EXISTS (SELECT 1 FROM reviews WHERE appointment_id = :id)', ['id' => $appointmentId]);
    }

    public function eligibleAppointments(string $userId): array
    {
        return $this->fetchAll(
            "SELECT a.id, a.reference_code, s.slot_date, t.name AS scan_name, b.name AS branch_name
             FROM appointments a
             JOIN patients p ON p.id = a.patient_id
             JOIN slots s ON s.id = a.slot_id
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN branches b ON b.id = a.branch_id
             WHERE p.user_id = :user_id AND a.status = 'completed'
               AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.appointment_id = a.id)
             ORDER BY s.slot_date DESC, s.start_time DESC LIMIT 50",
            ['user_id' => $userId]
        );
    }

    public function forUser(string $userId): array
    {
        return $this->fetchAll(
            'SELECT r.id, r.display_name, r.rating, r.body, r.status, r.verified_visit, r.created_at
             FROM reviews r JOIN patients p ON p.id = r.patient_id
             WHERE p.user_id = :user_id AND r.is_demo = FALSE
             ORDER BY r.created_at DESC LIMIT 100',
            ['user_id' => $userId]
        );
    }
}
