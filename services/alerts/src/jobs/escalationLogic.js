const TERMINAL = new Set(['acknowledged', 'resolved', 'cancelled'])

export const dueAt = (alert, windowMs) => {
  if (alert.next_escalation_at) return new Date(alert.next_escalation_at).getTime()
  const base = alert.last_notified_at ?? alert.created_at
  return new Date(base).getTime() + windowMs
}

export const decideEscalation = (alert, now, windowMs) => {
  if (TERMINAL.has(alert.status) || alert.acknowledged_at) return 'none'
  const level = Number(alert.escalation_level ?? 0)
  if (level >= 2) return 'none'
  if (now.getTime() < dueAt(alert, windowMs)) return 'none'
  return level === 0 ? 'resend' : 'flag_staff'
}
