export const THREAT_SQL = 'sqli'
export const THREAT_HTML = 'xss'
export const THREAT_ENCODING = 'encoding'

const SQL_PATTERNS = [
  /'\s*(?:or|and)\s+'?[\w\s]*'?\s*(?:=|<|>|like\b)/i,
  /\b(?:or|and)\s+'?\d+'?\s*=\s*'?\d+/i,
  /'\s*(?:;|--|#|\/\*)/,
  /;\s*(?:--|#|\/\*)/,
  /\b(?:drop|truncate|alter|create)\s+(?:table|database|schema|user|role|function|view)\b/i,
  /\bunion\b(?:\s+all|\s+distinct)?\s+select\b/i,
  /\binsert\s+into\b/i,
  /\bdelete\s+from\b/i,
  /\bupdate\s+\w+\s+set\b/i,
  /\bselect\b[\s\S]{0,80}\bfrom\s+(?:users|pg_\w+|information_schema)\b/i,
  /\b(?:pg_sleep|benchmark)\s*\(/i,
  /\bsleep\s*\(\s*\d+\s*\)/i,
  /\bwaitfor\s+delay\b/i,
  /\bexec(?:ute)?\s+(?:xp_|sp_)\w+/i,
  /\b(?:information_schema|pg_catalog|pg_shadow)\b/i,
  /\/\*[\s\S]*?\*\//,
]

const HTML_PATTERNS = [
  /<\s*\/?\s*[a-z!?]/i,
  /\b(?:javascript|vbscript|livescript)\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  /\bon[a-z]{3,}\s*=/i,
  /&#x?[0-9a-f]+;?/i,
  /\bexpression\s*\(/i,
]

const rawUrlDecode = (value) =>
  value.replace(/(?:%[0-9a-fA-F]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run)
    } catch {
      return run
    }
  })

export const clean = (value, multiline = false) => {
  let text = value.replace(/\r\n|\r/g, '\n')
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  text = text.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
  if (multiline) {
    const lines = text.split('\n').map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }
  return text.replace(/[\s ]+/g, ' ').trim()
}

export const detectThreat = (value) => {
  if (!value.isWellFormed()) return THREAT_ENCODING
  for (const candidate of [value, rawUrlDecode(value)]) {
    if (HTML_PATTERNS.some((pattern) => pattern.test(candidate))) return THREAT_HTML
    if (SQL_PATTERNS.some((pattern) => pattern.test(candidate))) return THREAT_SQL
  }
  return null
}

export const isSafe = (value) => detectThreat(value) === null

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
