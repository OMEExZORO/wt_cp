<?php

declare(strict_types=1);

namespace App\Models;

final class ChecklistItem extends Model
{
    protected const TABLE = 'checklist_items';
    protected const FILLABLE = ['scan_type_id', 'modality', 'code', 'question', 'help_text', 'answer_type', 'is_required', 'sort_order', 'is_active'];

    public function forScanType(string $scanTypeId, string $modality): array
    {
        return $this->fetchAll(
            'SELECT id, scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order
             FROM checklist_items
             WHERE is_active = TRUE AND (scan_type_id = :scan_type_id OR modality = :modality)
             ORDER BY sort_order, code',
            ['scan_type_id' => $scanTypeId, 'modality' => $modality]
        );
    }
}
