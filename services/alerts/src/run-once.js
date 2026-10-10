import { runJob } from './jobs/scheduler.js'
import { pool } from './db.js'

let failed = false
for (const name of ['escalation', 'reminders']) {
  try {
    const result = await runJob(name)
    process.stdout.write(`${name}: ${JSON.stringify(result)}\n`)
  } catch (error) {
    failed = true
    process.stderr.write(`${name} failed: ${error.message}\n`)
  }
}
await pool.end().catch(() => {})
process.exit(failed ? 1 : 0)
