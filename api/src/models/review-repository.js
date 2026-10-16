import { Model } from './model.js'

export class ReviewRepository extends Model {
  appointmentForReview(appointmentId) {
    return this.db.one(
      `SELECT a.id, a.status, a.patient_id, p.user_id AS patient_user_id
             FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = $1`,
      [appointmentId],
    )
  }

  async existsForAppointment(appointmentId) {
    return Boolean(await this.db.value('SELECT EXISTS (SELECT 1 FROM reviews WHERE appointment_id = $1)', [appointmentId]))
  }

  eligibleAppointments(userId) {
    return this.db.all(
      `SELECT a.id, a.reference_code, s.slot_date, t.name AS scan_name, b.name AS branch_name
             FROM appointments a
             JOIN patients p ON p.id = a.patient_id
             JOIN slots s ON s.id = a.slot_id
             JOIN scan_types t ON t.id = a.scan_type_id
             JOIN branches b ON b.id = a.branch_id
             WHERE p.user_id = $1 AND a.status = 'completed'
               AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.appointment_id = a.id)
             ORDER BY s.slot_date DESC, s.start_time DESC LIMIT 50`,
      [userId],
    )
  }

  forUser(userId) {
    return this.db.all(
      `SELECT r.id, r.display_name, r.rating, r.body, r.status, r.verified_visit, r.created_at
             FROM reviews r JOIN patients p ON p.id = r.patient_id
             WHERE p.user_id = $1 AND r.is_demo = FALSE
             ORDER BY r.created_at DESC LIMIT 100`,
      [userId],
    )
  }
}
