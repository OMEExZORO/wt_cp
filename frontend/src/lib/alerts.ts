import type { AlertEventItem, QueueItem, Urgency, WaitLevel } from '../types/alerts'

const URGENCY_RANK: Record<Urgency, number> = { Urgent: 0, Priority: 1, Routine: 2 }

export function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      b.waiting_minutes - a.waiting_minutes ||
      a.reference_code.localeCompare(b.reference_code),
  )
}

export function formatWaiting(minutes: number): string {
  if (minutes < 1) return 'Under 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
  const days = Math.floor(hours / 24)
  return `${days} d ${hours % 24} h`
}

export const WAIT_LABEL: Record<WaitLevel, string> = {
  ok: 'Within target',
  warning: 'Getting long',
  overdue: 'Overdue',
}

export const WAIT_SYMBOL: Record<WaitLevel, string> = {
  ok: '●',
  warning: '▲',
  overdue: '■',
}

const EVENT_LABEL: Record<string, string> = {
  raised: 'Alert raised by doctor',
  notified: 'Notification sent',
  resent: 'Reminder resent',
  escalated: 'Escalated (no acknowledgement)',
  staff_flagged: 'Flagged for reception to phone the patient',
  acknowledged: 'Acknowledged',
  phone_contacted: 'Patient contacted by phone',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  delivery_failed: 'Delivery failed',
}

const CHANNEL_LABEL: Record<string, string> = {
  email: 'email',
  in_app: 'in-app banner',
  sms_stub: 'SMS (stub)',
  phone: 'phone',
}

export function describeEvent(event: AlertEventItem): string {
  const base = EVENT_LABEL[event.event_type] ?? event.event_type
  const channel = event.channel !== null ? CHANNEL_LABEL[event.channel] ?? event.channel : null
  const recipient = typeof event.details.recipient === 'string' ? event.details.recipient : null
  const parts = [base]
  if (recipient !== null) parts.push(`to ${recipient}`)
  if (channel !== null) parts.push(`via ${channel}`)
  return parts.join(' ')
}

export function actorOf(event: AlertEventItem): string {
  if (event.actor_type === 'system') return 'System'
  return event.actor_name ?? 'Staff'
}
