export const alertMessage = ({ recipientName, audienceLabel, portalUrl, reminder }) => {
  const lines = [
    `Dear ${recipientName || 'Sir/Madam'},`,
    '',
    `A critical radiology finding has been recorded for ${audienceLabel}.`,
  ]
  if (reminder) lines.push('We have not yet received an acknowledgement.')
  lines.push(
    'Please sign in to the DiagnoCare portal and acknowledge this alert as soon as possible.',
    portalUrl,
    '',
    'If you cannot sign in, please call Meghnad Diagnostic Centre immediately.',
    'This message does not contain medical advice and is not for emergencies.',
  )
  return {
    subject: reminder ? 'REMINDER: critical finding awaiting your acknowledgement' : 'Critical finding requires your acknowledgement',
    text: lines.join('\n'),
  }
}

export const reminderMessage = ({ patientName, appointment, prepTips, checklist }) => {
  const lines = [
    `Dear ${patientName || 'Patient'},`,
    '',
    `This is a reminder of your appointment (${appointment.reference_code}).`,
    `Scan: ${appointment.scan_name}`,
    `Branch: ${appointment.branch_name}${appointment.branch_address ? `, ${appointment.branch_address}` : ''}`,
    `When: ${appointment.when_label}`,
  ]
  if (prepTips) lines.push('', 'Preparation instructions:', prepTips)
  if (checklist.length) {
    lines.push('', 'Please keep these points in mind:')
    for (const item of checklist) lines.push(`- ${item.question}${item.help_text ? ` (${item.help_text})` : ''}`)
  }
  lines.push('', 'To reschedule or cancel, please sign in to your DiagnoCare account.')
  lines.push('This message does not contain medical advice and is not for emergencies.')
  return { subject: `Appointment reminder: ${appointment.scan_name}`, text: lines.join('\n') }
}
