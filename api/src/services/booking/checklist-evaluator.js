import { flag } from '../../models/flag.js'

export const ANSWER_MAX = 500

export const checklistRules = (items) => {
  const rules = {}
  for (const item of items) {
    const presence = flag(item.is_required) ? 'required' : 'nullable'
    switch (String(item.answer_type)) {
      case 'yes_no':
        rules[String(item.id)] = `${presence}|in:yes,no`
        break
      case 'yes_no_unsure':
        rules[String(item.id)] = `${presence}|in:yes,no,unsure`
        break
      case 'date':
        rules[String(item.id)] = `${presence}|date|after:1900-01-01|before_or_equal:today`
        break
      default:
        rules[String(item.id)] = `${presence}|text|max:${ANSWER_MAX}`
    }
  }
  return rules
}

const parseCsv = (text) => {
  const values = []
  let current = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

export const attentionAnswers = (value) => {
  if (Array.isArray(value)) return value.map(String)
  const text = String(value ?? '').trim()
  if (text === '' || text === '{}') return []
  const inner = text.slice(1, -1)
  if (inner === '') return []
  return parseCsv(inner)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

export const evaluateAnswers = (items, answers) => {
  const result = []
  for (const item of items) {
    const id = String(item.id)
    const raw = answers[id] ?? null
    if (raw === null || raw === '') continue
    const answer = String(raw)
    result.push({
      checklist_item_id: id,
      code: String(item.code),
      question: String(item.question),
      answer,
      needs_attention: attentionAnswers(item.attention_answers ?? []).some(
        (candidate) => candidate.toLowerCase() === answer.toLowerCase(),
      ),
    })
  }
  return result
}

export const prefixErrors = (fields, prefix = 'answers') =>
  Object.fromEntries(Object.entries(fields).map(([key, message]) => [`${prefix}.${key}`, message]))
