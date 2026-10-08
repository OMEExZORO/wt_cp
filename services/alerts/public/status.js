const text = (id, value) => {
  document.getElementById(id).textContent = String(value)
}

const row = (name, job) => {
  const tr = document.createElement('tr')
  const cells = [
    name,
    job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'never',
    job.last_duration_ms === null ? '-' : `${job.last_duration_ms} ms`,
    job.last_error ? `error: ${job.last_error}` : job.last_result ? JSON.stringify(job.last_result) : '-',
  ]
  for (const value of cells) {
    const td = document.createElement('td')
    td.textContent = value
    tr.appendChild(td)
  }
  return tr
}

const refresh = async () => {
  try {
    const response = await fetch('/api/status')
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ? body.error.message : 'Request failed')
    const { alerts, jobs, time } = body.data
    text('state', `Online. Updated ${new Date(time).toLocaleTimeString()}`)
    text('open', alerts.open)
    text('escalated', alerts.escalated)
    text('flagged', alerts.staff_flagged)
    const tbody = document.getElementById('jobs')
    tbody.replaceChildren(...Object.entries(jobs).map(([name, job]) => row(name, job)))
  } catch (error) {
    text('state', `Unavailable: ${error.message}`)
  }
}

refresh()
setInterval(refresh, 15000)
