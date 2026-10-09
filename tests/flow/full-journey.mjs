import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Client } from './lib/client.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')

const readEnvFile = (file) => {
  const values = {}
  if (!fs.existsSync(file)) return values
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return values
}

const fileEnv = readEnvFile(path.join(repoRoot, '.env'))
const env = (key, fallback = '') => process.env[key] ?? fileEnv[key] ?? fallback

const API = env('FLOW_API_BASE', 'http://localhost:8021/api/v1')
const ALERTS = env('FLOW_ALERTS_BASE', 'http://localhost:4021')
const MAIL_LOG = env('FLOW_MAIL_LOG', path.join(repoRoot, 'backend/storage/logs/mail.log'))
const SERVICE_TOKEN = env('ALERTS_SERVICE_TOKEN')
const WINDOW_MINUTES = Number(env('FLOW_ESCALATION_MINUTES', '1'))
const KEEP = process.argv.includes('--keep')

const DEV = {
  admin: ['admin@diagnocare.test', 'Admin@Dev2026!'],
  doctor: ['doctor@diagnocare.test', 'Doctor@Dev2026!'],
}

const stamp = Date.now().toString(36)
const patient = {
  email: `flow.${stamp}@diagnocare.test`,
  name: `Flow Test ${stamp.replace(/[0-9]/g, (d) => 'abcdefghij'[d])}`,
  phone: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'),
  password: `Flow@${crypto.randomBytes(6).toString('hex')}Aa1!`,
}

const results = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const step = async (name, fn) => {
  const started = Date.now()
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail ?? '', ms: Date.now() - started })
    console.log(`PASS  ${name}${detail ? ' :: ' + detail : ''}`)
  } catch (error) {
    results.push({ name, ok: false, detail: error.message, ms: Date.now() - started })
    console.log(`FAIL  ${name} :: ${error.message}`)
    throw error
  }
}

const expect = (condition, message) => {
  if (!condition) throw new Error(message)
}

const expectStatus = (res, status, label) => {
  expect(res.status === status, `${label}: expected HTTP ${status}, got ${res.status} ${res.json?.error?.code ?? ''} ${JSON.stringify(res.json?.error?.fields ?? '')}`)
}

const verificationToken = (email) => {
  const log = fs.readFileSync(MAIL_LOG, 'utf8')
  const entries = log.split('='.repeat(72))
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].includes(`<${email}>`) && entries[i].includes('Verify your email address')) {
      const match = entries[i].match(/verify-email\?token=([0-9a-f]{64})/)
      if (match) return match[1]
    }
  }
  return null
}

const pdfBytes = () => {
  const marker = `FLOW-TEST-REPORT ${stamp} ${crypto.randomBytes(16).toString('hex')}`
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n% ${marker}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`)
}

const state = { appointmentId: null, reportId: null, alertId: null, userId: null, upload: pdfBytes() }
const anon = new Client(API)
const patientClient = new Client(API)
const doctor = new Client(API)
const admin = new Client(API)

const run = async () => {
  await step('API and alerts worker are healthy', async () => {
    const api = await anon.get('/health')
    expectStatus(api, 200, 'api health')
    const worker = await fetch(`${ALERTS}/health`)
    expect(worker.status === 200, `alerts health ${worker.status}`)
  })

  await step('register a new patient (consent given)', async () => {
    const res = await patientClient.post('/auth/register', {
      account_type: 'patient',
      full_name: patient.name,
      email: patient.email,
      phone: patient.phone,
      password: patient.password,
      password_confirmation: patient.password,
      consent: true,
    })
    expectStatus(res, 201, 'register')
    state.userId = res.json.data.user.id
    expect(res.json.data.user.email_verified_at == null, 'new account should be unverified')
    return `user ${state.userId}`
  })

  await step('booking is blocked until the email is verified', async () => {
    const res = await patientClient.post('/appointments', { scan_type_id: '00000000-0000-4000-8000-000000000000', slot_id: '00000000-0000-4000-8000-000000000000', consent: true })
    expect([403, 422].includes(res.status) && res.json?.error, `expected 403/422 envelope, got ${res.status}`)
    return `HTTP ${res.status} ${res.json.error.code}`
  })

  await step('verify email using the token from mail.log', async () => {
    let token = null
    for (let i = 0; i < 10 && !token; i += 1) {
      token = verificationToken(patient.email)
      if (!token) await sleep(300)
    }
    expect(token, 'verification token not found in mail.log')
    const res = await patientClient.post('/auth/email/verify', { token })
    expectStatus(res, 200, 'verify')
    const me = await patientClient.get('/auth/me')
    expectStatus(me, 200, 'me')
    expect(me.json.data.user.email_verified_at, 'email_verified_at not set')
    const reuse = await patientClient.post('/auth/email/verify', { token })
    expectStatus(reuse, 422, 'token reuse')
    return 'verified; token single-use confirmed'
  })

  let scan
  let slot
  await step('find a bookable scan and an open slot', async () => {
    const branches = await anon.get('/public/branches')
    expectStatus(branches, 200, 'branches')
    const branchList = branches.json.data.branches ?? branches.json.data
    const branch = branchList.find((b) => b.is_active !== false) ?? branchList[0]
    const types = await anon.get('/public/scan-types')
    expectStatus(types, 200, 'scan types')
    const typeList = types.json.data.scan_types ?? types.json.data
    scan = typeList.find((t) => t.modality === 'USG' && t.is_bookable_online !== false)
    expect(scan, 'no bookable USG scan type')
    for (let offset = 1; offset <= 14 && !slot; offset += 1) {
      const date = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
      const res = await patientClient.get('/booking/availability', { branch_id: branch.id, scan_type_id: scan.id, date })
      if (res.status !== 200) continue
      slot = res.json.data.slots.find((s) => s.is_available)
    }
    expect(slot, 'no available slot in the next 14 days')
    return `${scan.name} on slot ${slot.id}`
  })

  await step('book the appointment', async () => {
    const checklist = await patientClient.get(`/scan-types/${scan.id}/checklist`)
    expectStatus(checklist, 200, 'checklist')
    const answers = {}
    for (const item of checklist.json.data.items) {
      if (item.answer_type === 'text') answers[item.id] = 'None'
      else if (item.answer_type === 'date') answers[item.id] = '2026-01-01'
      else answers[item.id] = 'no'
    }
    const res = await patientClient.post('/appointments', { scan_type_id: scan.id, slot_id: slot.id, consent: true, patient_notes: 'Flow test booking', answers })
    expectStatus(res, 201, 'book')
    state.appointmentId = res.json.data.appointment.id
    return `appointment ${state.appointmentId}`
  })

  await step('doctor logs in and uploads a PDF report', async () => {
    expectStatus(await doctor.login(...DEV.doctor), 200, 'doctor login')
    const form = new FormData()
    form.set('appointment_id', state.appointmentId)
    form.set('title', `Flow test report ${stamp}`)
    form.set('status', 'final')
    form.set('file', new Blob([state.upload], { type: 'application/pdf' }), 'flow-test-report.pdf')
    const res = await doctor.postForm('/reports', form)
    expectStatus(res, 201, 'upload')
    state.reportId = res.json.data.report.id
    return `report ${state.reportId}, ${state.upload.length} bytes`
  })

  await step('doctor flags the report critical', async () => {
    const res = await doctor.post(`/reports/${state.reportId}/critical`, { note: 'Flow test: urgent finding, please call the patient.' })
    expectStatus(res, 201, 'flag')
    state.alertId = res.json.data.alert.id
    expect(res.json.data.alert.status === 'notified' || res.json.data.alert.status === 'open', `unexpected status ${res.json.data.alert.status}`)
    return `alert ${state.alertId}`
  })

  await step('a second flag on the same report is refused', async () => {
    expectStatus(await doctor.post(`/reports/${state.reportId}/critical`, {}), 409, 'duplicate flag')
  })

  await step('escalation endpoint rejects a missing or wrong token', async () => {
    const none = await fetch(`${ALERTS}/api/jobs/escalate/run`, { method: 'POST' })
    expect(none.status === 401, `no token: ${none.status}`)
    const bad = await fetch(`${ALERTS}/api/jobs/escalate/run`, { method: 'POST', headers: { 'X-Service-Token': 'wrong-token' } })
    expect(bad.status === 401, `bad token: ${bad.status}`)
  })

  const runEscalation = async () => {
    const res = await fetch(`${ALERTS}/api/jobs/escalate/run`, { method: 'POST', headers: { 'X-Service-Token': SERVICE_TOKEN } })
    const body = await res.json()
    expect(res.status === 200, `escalate run ${res.status} ${JSON.stringify(body.error)}`)
    return body.data
  }

  const eventTypes = async () => {
    const res = await doctor.get(`/alerts/${state.alertId}/events`)
    expectStatus(res, 200, 'events')
    return res.json.data.events.map((e) => e.event_type)
  }

  await step(`stage 1 escalation after the ${WINDOW_MINUTES} minute window (resend to patient)`, async () => {
    const early = await runEscalation()
    expect(!(await eventTypes()).includes('escalated'), 'escalated before the window elapsed')
    const deadline = Date.now() + (WINDOW_MINUTES * 60 + 150) * 1000
    let summary = early
    while (Date.now() < deadline) {
      await sleep(10000)
      summary = await runEscalation()
      if ((await eventTypes()).includes('escalated')) break
    }
    const types = await eventTypes()
    expect(types.includes('escalated'), `no escalated event; events: ${types.join(',')}`)
    return `job summary ${JSON.stringify(summary)}; events ${types.join(',')}`
  })

  await step(`stage 2 escalation flags reception to phone the patient`, async () => {
    const deadline = Date.now() + (WINDOW_MINUTES * 60 + 150) * 1000
    let types = await eventTypes()
    while (!types.includes('staff_flagged') && Date.now() < deadline) {
      await sleep(10000)
      await runEscalation()
      types = await eventTypes()
    }
    expect(types.includes('staff_flagged'), `no staff_flagged event; events: ${types.join(',')}`)
    return `events ${types.join(',')}`
  })

  await step('patient sees the alert banner and acknowledges it', async () => {
    const mine = await patientClient.get('/alerts/mine')
    expectStatus(mine, 200, 'alerts/mine')
    expect(mine.json.data.alerts.some((a) => a.id === state.alertId), 'alert not in patient banner list')
    const ack = await patientClient.post(`/alerts/${state.alertId}/acknowledge`, {})
    expectStatus(ack, 200, 'acknowledge')
    const after = await patientClient.get('/alerts/mine')
    expect(!after.json.data.alerts.some((a) => a.id === state.alertId), 'alert still shown after acknowledgement')
    const events = await eventTypes()
    expect(events.includes('acknowledged'), 'no acknowledged event')
    const again = await runEscalation()
    expect(!(await eventTypes()).slice(-1).includes('escalated'), 'escalation ran after acknowledgement')
    return `events ${events.join(',')}; post-ack job ${JSON.stringify(again)}`
  })

  await step('patient downloads the report and the bytes match the upload', async () => {
    const res = await patientClient.raw('GET', `/reports/${state.reportId}/download`)
    expectStatus(res, 200, 'download')
    expect(Buffer.compare(res.buffer, state.upload) === 0, `bytes differ: got ${res.buffer.length}, uploaded ${state.upload.length}`)
    expect((res.headers.get('content-type') ?? '').startsWith('application/pdf'), 'content-type is not application/pdf')
    expect((res.headers.get('content-disposition') ?? '').startsWith('attachment'), 'not served as attachment')
    expect(res.headers.get('x-content-type-options') === 'nosniff', 'missing nosniff')
    const sha = crypto.createHash('sha256').update(res.buffer).digest('hex').slice(0, 16)
    return `${res.buffer.length} bytes identical, sha256 ${sha}`
  })

  await step('another patient cannot download the report (IDOR)', async () => {
    const other = new Client(API)
    expectStatus(await other.login('patient@diagnocare.test', 'Patient@Dev2026!'), 200, 'dev patient login')
    const res = await other.raw('GET', `/reports/${state.reportId}/download`)
    expect([403, 404].includes(res.status), `expected 403/404, got ${res.status}`)
    return `HTTP ${res.status}`
  })
}

const cleanup = async () => {
  if (KEEP) {
    console.log('SKIP  cleanup (--keep)')
    return
  }
  const note = []
  try {
    if (state.appointmentId) {
      const res = await patientClient.patch(`/appointments/${state.appointmentId}/cancel`, { reason: 'Flow test cleanup' })
      note.push(`cancel appointment ${res.status}`)
    }
    expectStatus(await admin.login(...DEV.admin), 200, 'admin login')
    if (state.reportId) {
      const res = await admin.del(`/reports/${state.reportId}`)
      note.push(`delete report ${res.status}`)
    }
    if (state.userId) {
      const res = await admin.patch(`/admin/users/${state.userId}`, { is_active: false })
      note.push(`deactivate user ${res.status}`)
    }
  } catch (error) {
    note.push(`cleanup error: ${error.message}`)
  }
  console.log(`CLEAN ${note.join(', ')}`)
  if (state.userId) console.log(`LEFTOVER dev data (labelled): user "${patient.name}" <${patient.email}> deactivated; critical_alerts row ${state.alertId} and its append-only alert_events rows cannot be deleted; audit_log and report_access_log entries remain; mail.log entries remain.`)
}

const started = Date.now()
let failed = false
try {
  await run()
} catch {
  failed = true
}
await cleanup()
const passed = results.filter((r) => r.ok).length
console.log(`\nFLOW RESULT: ${passed}/${results.length} steps passed${failed ? ' (stopped at first failure)' : ''} in ${Math.round((Date.now() - started) / 1000)}s`)
process.exit(failed ? 1 : 0)
