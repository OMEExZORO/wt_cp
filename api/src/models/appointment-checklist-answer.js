import { Model } from './model.js'

export class AppointmentChecklistAnswer extends Model {
  static table = 'appointment_checklist_answers'
  static fillable = ['appointment_id', 'checklist_item_id', 'answer', 'needs_attention']

  async insertMany(appointmentId, answers) {
    for (const answer of answers) {
      await this.db.execute(
        `INSERT INTO appointment_checklist_answers (appointment_id, checklist_item_id, answer, needs_attention)
                 VALUES ($1, $2, $3, $4)`,
        [appointmentId, answer.checklist_item_id, answer.answer, Boolean(answer.needs_attention)],
      )
    }
  }

  forAppointment(appointmentId) {
    return this.db.all(
      `SELECT ca.checklist_item_id, ca.answer, ca.needs_attention, ci.code, ci.question, ci.answer_type
             FROM appointment_checklist_answers ca
             JOIN checklist_items ci ON ci.id = ca.checklist_item_id
             WHERE ca.appointment_id = $1
             ORDER BY ci.sort_order, ci.code`,
      [appointmentId],
    )
  }

  async attentionFor(appointmentIds) {
    if (appointmentIds.length === 0) return {}
    const placeholders = appointmentIds.map((_, index) => `$${index + 1}`)
    const rows = await this.db.all(
      `SELECT ca.appointment_id, ci.code, ci.question, ca.answer
             FROM appointment_checklist_answers ca
             JOIN checklist_items ci ON ci.id = ca.checklist_item_id
             WHERE ca.needs_attention AND ca.appointment_id IN (${placeholders.join(', ')})
             ORDER BY ci.sort_order, ci.code`,
      appointmentIds,
    )
    const grouped = {}
    for (const row of rows) {
      const key = String(row.appointment_id)
      grouped[key] ??= []
      grouped[key].push({ code: row.code, question: row.question, answer: row.answer })
    }
    return grouped
  }
}
