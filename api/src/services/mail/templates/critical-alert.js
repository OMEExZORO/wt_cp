import { escapeHtml as e } from '../../../validation/sanitizer.js'

const BUTTON_STYLE =
  'display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;'

export const criticalAlert = (v) => ({
  subject: `Action needed: an important finding in a report from ${v.clinic_name}`,
  text: `Hello ${v.name},\n\n${v.intro}\n\nScan: ${v.scan_name}\nReference: ${v.reference}\n\nPlease sign in to your portal and acknowledge this alert, then contact the centre as soon as possible:\n${v.link}\n\nFor your privacy, the finding itself is not included in this email.\n`,
  html: `
<p>Hello ${e(v.name)},</p>
<p><strong>${e(v.intro)}</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Scan</td><td>${e(v.scan_name)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Reference</td><td>${e(v.reference)}</td></tr>
</table>
<p>Please sign in to your portal and acknowledge this alert, then contact the centre as soon as possible.</p>
<p><a href="${e(v.link)}" style="${BUTTON_STYLE}">Sign in and acknowledge</a></p>
<p style="font-size:13px;color:#3a3f4b;">For your privacy, the finding itself is not included in this email.</p>
`,
})
