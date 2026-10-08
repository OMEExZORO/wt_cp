import { audit } from '../lib/audit.js'
import { runEscalation } from './escalation.js'
import { runReminders } from './reminders.js'

const blank = () => ({ last_run_at: null, last_duration_ms: null, last_result: null, last_error: null, running: false })
const state = { escalation: blank(), reminders: blank() }
const jobs = { escalation: runEscalation, reminders: runReminders }

export const runJob = async (name) => {
  const entry = state[name]
  if (entry.running) return { skipped: true, reason: 'already_running' }
  entry.running = true
  const started = Date.now()
  try {
    const result = await jobs[name]()
    entry.last_result = result
    entry.last_error = null
    audit.info(`job.${name}`, result)
    return result
  } catch (error) {
    entry.last_error = String(error.message).slice(0, 200)
    audit.error(`job.${name}.failed`, { reason: entry.last_error })
    throw error
  } finally {
    entry.running = false
    entry.last_run_at = new Date().toISOString()
    entry.last_duration_ms = Date.now() - started
  }
}

export const jobStatus = () => structuredClone(state)

export const startScheduler = (intervalSeconds) => {
  const tick = () => {
    for (const name of Object.keys(jobs)) runJob(name).catch(() => {})
  }
  const timer = setInterval(tick, intervalSeconds * 1000)
  setTimeout(tick, 2000).unref()
  return () => clearInterval(timer)
}
