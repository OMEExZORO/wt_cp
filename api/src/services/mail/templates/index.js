import { escapeHtml as e } from '../../../validation/sanitizer.js'
import { bookingTemplates } from './booking.js'
import { criticalAlert } from './critical-alert.js'

const BUTTON_STYLE =
  'display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;'

export const layout = ({ title, content, clinic_name: clinicName }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2430;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#1b2a5c;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:bold;">${e(clinicName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6;">${content}</td></tr>
<tr><td style="padding:16px 24px;background:#ece8f6;font-size:12px;line-height:1.5;color:#3a3f4b;">
This is an automated message from ${e(clinicName)}. Please do not reply to this email.<br>
This service does not provide medical advice and is not for emergencies. In an emergency call 112.<br>
Prenatal sex determination is prohibited under the PCPNDT Act.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`

export const templates = {
  'verify-email': (v) => ({
    subject: 'Verify your email address',
    text: `Hello ${v.name},\n\nPlease confirm your email address for your ${v.clinic_name} account by opening this link:\n\n${v.link}\n\nThe link expires in ${v.hours} hours. If you did not create an account, you can ignore this email.\n`,
    html: `
<p>Hello ${e(v.name)},</p>
<p>Please confirm your email address for your ${e(v.clinic_name)} account.</p>
<p><a href="${e(v.link)}" style="${BUTTON_STYLE}">Verify email address</a></p>
<p>Or copy this link into your browser:<br><span style="word-break:break-all;">${e(v.link)}</span></p>
<p>The link expires in ${e(v.hours)} hours. If you did not create an account, you can ignore this email.</p>
`,
  }),

  'password-reset': (v) => ({
    subject: 'Reset your password',
    text: `Hello ${v.name},\n\nWe received a request to reset the password for your ${v.clinic_name} account. Open this link to choose a new password:\n\n${v.link}\n\nThe link expires in ${v.minutes} minutes and can be used once. If you did not ask for this, you can ignore this email; your password will not change.\n`,
    html: `
<p>Hello ${e(v.name)},</p>
<p>We received a request to reset the password for your ${e(v.clinic_name)} account.</p>
<p><a href="${e(v.link)}" style="${BUTTON_STYLE}">Choose a new password</a></p>
<p>Or copy this link into your browser:<br><span style="word-break:break-all;">${e(v.link)}</span></p>
<p>The link expires in ${e(v.minutes)} minutes and can be used once. If you did not ask for this, you can ignore this email; your password will not change.</p>
`,
  }),

  ...bookingTemplates,
  'critical-alert': criticalAlert,

  'password-changed': (v) => ({
    subject: 'Your password was changed',
    text: `Hello ${v.name},\n\nThe password for your ${v.clinic_name} account was changed on ${v.changed_at}. You have been signed out on other devices.\n\nIf you did not make this change, reset your password at ${v.reset_link} and contact the centre.\n`,
    html: `
<p>Hello ${e(v.name)},</p>
<p>The password for your ${e(v.clinic_name)} account was changed on ${e(v.changed_at)}. You have been signed out on other devices.</p>
<p>If you did not make this change, <a href="${e(v.reset_link)}">reset your password</a> and contact the centre.</p>
`,
  }),
}
