<?php

declare(strict_types=1);

namespace App\Models;

final class AppointmentChecklistAnswer extends Model
{
    protected const TABLE = 'appointment_checklist_answers';
    protected const FILLABLE = ['appointment_id', 'checklist_item_id', 'answer', 'needs_attention'];

    public function insertMany(string $appointmentId, array $answers): void
    {
        foreach ($answers as $answer) {
            $this->execute(
                'INSERT INTO appointment_checklist_answers (appointment_id, checklist_item_id, answer, needs_attention)
                 VALUES (:appointment_id, :checklist_item_id, :answer, :needs_attention)',
                [
                    'appointment_id' => $appointmentId,
                    'checklist_item_id' => $answer['checklist_item_id'],
                    'answer' => $answer['answer'],
                    'needs_attention' => (bool) $answer['needs_attention'],
                ]
            );
        }
    }

    public function forAppointment(string $appointmentId): array
    {
        return $this->fetchAll(
            'SELECT ca.checklist_item_id, ca.answer, ca.needs_attention, ci.code, ci.question, ci.answer_type
             FROM appointment_checklist_answers ca
             JOIN checklist_items ci ON ci.id = ca.checklist_item_id
             WHERE ca.appointment_id = :appointment_id
             ORDER BY ci.sort_order, ci.code',
            ['appointment_id' => $appointmentId]
        );
    }

    public function attentionFor(array $appointmentIds): array
    {
        if ($appointmentIds === []) {
            return [];
        }
        $placeholders = [];
        $params = [];
        foreach (array_values($appointmentIds) as $index => $id) {
            $placeholders[] = ':id' . $index;
            $params['id' . $index] = $id;
        }
        $rows = $this->fetchAll(
            'SELECT ca.appointment_id, ci.code, ci.question, ca.answer
             FROM appointment_checklist_answers ca
             JOIN checklist_items ci ON ci.id = ca.checklist_item_id
             WHERE ca.needs_attention AND ca.appointment_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY ci.sort_order, ci.code',
            $params
        );
        $grouped = [];
        foreach ($rows as $row) {
            $grouped[(string) $row['appointment_id']][] = ['code' => $row['code'], 'question' => $row['question'], 'answer' => $row['answer']];
        }
        return $grouped;
    }
}
