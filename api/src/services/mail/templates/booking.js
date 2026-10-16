import { escapeHtml as e } from '../../../validation/sanitizer.js'

const BUTTON_STYLE =
  'display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;'
const LABEL = 'padding:2px 12px 2px 0;font-weight:bold;'

const row = (label, value) => `<tr><td style="${LABEL}">${label}</td><td>${value}</td></tr>\n`

export const bookingTemplates = {
  'booking-confirmed': (v) => ({
    subject: `Appointment confirmed: ${v.scan_name} (${v.reference})`,
    text:
      `Hello ${v.name},\n\nYour appointment is confirmed.\n\nReference: ${v.reference}\nScan: ${v.scan_name}\nWhen: ${v.when}\nWhere: ${v.location}\n\n` +
      (v.preparation !== '' ? `How to prepare:\n${v.preparation}\n\n` : '') +
      "Please bring your doctor's referral, any previous reports, a list of your current medicines and a photo ID.\n\n" +
      `A calendar file (.ics) is attached. You can view, reschedule or cancel this appointment here:\n${v.link}\n\n` +
      'If you answered yes or unsure to any safety question, our staff will review it and may contact you before your visit.\n',
    html: `
<p>Hello ${e(v.name)},</p>
<p>Your appointment is confirmed.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
${row('Reference', e(v.reference))}${row('Scan', e(v.scan_name))}${row('When', e(v.when))}${row('Where', e(v.location))}</table>
${v.preparation !== '' ? `<p style="font-weight:bold;margin-bottom:4px;">How to prepare</p>\n<p style="margin-top:0;">${e(v.preparation)}</p>\n` : ''}<p>Please bring your doctor's referral, any previous reports, a list of your current medicines and a photo ID.</p>
<p>A calendar file (.ics) is attached to this email.</p>
<p><a href="${e(v.link)}" style="${BUTTON_STYLE}">View or manage appointment</a></p>
<p>If you answered yes or unsure to any safety question, our staff will review it and may contact you before your visit.</p>
`,
  }),

  'booking-rescheduled': (v) => ({
    subject: `Appointment rescheduled: ${v.scan_name} (${v.reference})`,
    text:
      `Hello ${v.name},\n\nYour appointment has been moved.\n\nReference: ${v.reference}\nScan: ${v.scan_name}\n` +
      (v.previous_when !== '' ? `Previous time: ${v.previous_when}\n` : '') +
      `New time: ${v.when}\nWhere: ${v.location}\n\n` +
      (v.preparation !== '' ? `How to prepare:\n${v.preparation}\n\n` : '') +
      `An updated calendar file (.ics) is attached. Manage your appointment here:\n${v.link}\n`,
    html: `
<p>Hello ${e(v.name)},</p>
<p>Your appointment has been moved.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
${row('Reference', e(v.reference))}${row('Scan', e(v.scan_name))}${v.previous_when !== '' ? row('Previous time', `<s>${e(v.previous_when)}</s>`) : ''}${row('New time', e(v.when))}${row('Where', e(v.location))}</table>
${v.preparation !== '' ? `<p style="font-weight:bold;margin-bottom:4px;">How to prepare</p>\n<p style="margin-top:0;">${e(v.preparation)}</p>\n` : ''}<p>An updated calendar file (.ics) is attached to this email.</p>
<p><a href="${e(v.link)}" style="${BUTTON_STYLE}">View or manage appointment</a></p>
`,
  }),

  'booking-cancelled': (v) => ({
    subject: `Appointment cancelled: ${v.scan_name} (${v.reference})`,
    text:
      `Hello ${v.name},\n\nYour appointment has been cancelled.\n\nReference: ${v.reference}\nScan: ${v.scan_name}\nWas booked for: ${v.when}\nWhere: ${v.location}\n` +
      (v.reason !== '' ? `Reason: ${v.reason}\n` : '') +
      `\nThe attached calendar file removes the event from calendars that support it. You can book a new appointment at any time from your portal:\n${v.link}\n`,
    html: `
<p>Hello ${e(v.name)},</p>
<p>Your appointment has been cancelled.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
${row('Reference', e(v.reference))}${row('Scan', e(v.scan_name))}${row('Was booked for', e(v.when))}${row('Where', e(v.location))}${v.reason !== '' ? row('Reason', e(v.reason)) : ''}</table>
<p>The attached calendar file removes the event from calendars that support it.</p>
<p><a href="${e(v.link)}" style="${BUTTON_STYLE}">Open your portal</a></p>
`,
  }),
}
