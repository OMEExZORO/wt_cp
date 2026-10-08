import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { RotatingLog, dayStamp } from '../src/lib/rotatingLog.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rotlog-'))

test('writes JSON lines to the active file', () => {
  const dir = tmp()
  const log = new RotatingLog({ dir, maxBytes: 10000 })
  log.info('hello', { a: 1 })
  const lines = log.tail(10)
  assert.equal(lines.length, 1)
  assert.equal(JSON.parse(lines[0]).event, 'hello')
})

test('rotates when the size cap is exceeded and prunes old archives', () => {
  const dir = tmp()
  const log = new RotatingLog({ dir, maxBytes: 120, keep: 2 })
  for (let i = 0; i < 12; i += 1) log.info('event', { i, pad: 'x'.repeat(40) })
  const archives = log.archives()
  assert.equal(archives.length, 2)
  assert.ok(fs.existsSync(path.join(dir, 'audit.log')))
  assert.ok(fs.statSync(path.join(dir, 'audit.log')).size <= 240)
  assert.ok(archives[1].seq > archives[0].seq)
})

test('rotates when the day changes', () => {
  const dir = tmp()
  let now = new Date(2026, 9, 8, 10, 0, 0)
  const log = new RotatingLog({ dir, maxBytes: 100000, clock: () => now })
  log.info('day one')
  now = new Date(2026, 9, 9, 10, 0, 0)
  log.info('day two')
  const archives = log.archives()
  assert.equal(archives.length, 1)
  assert.equal(archives[0].day, dayStamp(new Date(2026, 9, 8)))
  assert.equal(log.tail(10).length, 1)
  assert.equal(JSON.parse(log.tail(1)[0]).event, 'day two')
})

test('tail returns only the last lines', () => {
  const dir = tmp()
  const log = new RotatingLog({ dir, maxBytes: 100000 })
  for (let i = 0; i < 5; i += 1) log.info('e', { i })
  const lines = log.tail(2)
  assert.equal(lines.length, 2)
  assert.equal(JSON.parse(lines[1]).i, 4)
})
