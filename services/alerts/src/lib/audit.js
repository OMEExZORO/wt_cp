import { config } from '../config.js'
import { RotatingLog } from './rotatingLog.js'

export const audit = new RotatingLog({
  dir: config.logs.dir,
  baseName: 'audit',
  maxBytes: config.logs.maxBytes,
  keep: config.logs.keep,
})
