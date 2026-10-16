import { Model } from './model.js'

export class ChecklistItem extends Model {
  static table = 'checklist_items'
  static fillable = ['scan_type_id', 'modality', 'code', 'question', 'help_text', 'answer_type', 'is_required', 'sort_order', 'is_active']

  forScanType(scanTypeId, modality) {
    return this.db.all(
      `SELECT id, scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order
             FROM checklist_items
             WHERE is_active = TRUE AND (scan_type_id = $1 OR modality = $2)
             ORDER BY sort_order, code`,
      [scanTypeId, modality],
    )
  }
}
