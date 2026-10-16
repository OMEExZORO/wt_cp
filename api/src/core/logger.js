import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const format = (level, message, context) => {
  const tail = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
  return `[${new Date().toISOString()}] ${level} ${String(message).replace(/[\r\n]+/g, ' ')}${tail}`
}

export class Logger {
  constructor({ filePath = '', silent = false } = {}) {
    this.filePath = filePath
    this.silent = silent
  }

  info(message, context) {
    this.write('INFO', message, context)
  }

  warning(message, context) {
    this.write('WARNING', message, context)
  }

  error(message, context) {
    this.write('ERROR', message, context)
  }

  write(level, message, context) {
    if (this.silent) return
    const line = format(level, message, context)
    const stream = level === 'ERROR' ? process.stderr : process.stdout
    stream.write(`${line}\n`)
    if (this.filePath) {
      mkdir(path.dirname(this.filePath), { recursive: true })
        .then(() => appendFile(this.filePath, `${line}\n`))
        .catch(() => {})
    }
  }
}
