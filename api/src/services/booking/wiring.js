import { Appointment } from '../../models/appointment.js'
import { AppointmentChecklistAnswer } from '../../models/appointment-checklist-answer.js'
import { Branch } from '../../models/branch.js'
import { ChecklistItem } from '../../models/checklist-item.js'
import { ScanType } from '../../models/scan-type.js'
import { Slot } from '../../models/slot.js'
import { Clock } from '../clock.js'
import { AppointmentNotifier } from './appointment-notifier.js'
import { BookingService } from './booking-service.js'

export const wireBooking = (app) => {
  const options = { timezone: app.config.timezone }
  app.models.branches ??= new Branch(app.db, options)
  app.models.scanTypes ??= new ScanType(app.db, options)
  app.models.slots ??= new Slot(app.db, options)
  app.models.checklistItems ??= new ChecklistItem(app.db, options)
  app.models.appointments ??= new Appointment(app.db, options)
  app.models.checklistAnswers ??= new AppointmentChecklistAnswer(app.db, options)
  app.services.clock ??= new Clock({ timezone: app.config.timezone })
  app.services.booking ??= new BookingService({
    db: app.db,
    slots: app.models.slots,
    appointments: app.models.appointments,
    answers: app.models.checklistAnswers,
    clock: app.services.clock,
  })
  app.services.appointmentNotifier ??= new AppointmentNotifier({
    mail: app.mail,
    config: app.config,
    clock: app.services.clock,
  })
}
