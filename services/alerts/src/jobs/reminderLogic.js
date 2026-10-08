export const isReminderDue = (appointment, now, leadMs) => {
  if (appointment.status !== 'confirmed' || appointment.reminder_sent_at) return false
  const delta = new Date(appointment.starts_at).getTime() - now.getTime()
  return delta > 0 && delta <= leadMs
}

export const selectDueReminders = (appointments, now, leadMs) =>
  appointments.filter((appointment) => isReminderDue(appointment, now, leadMs))
