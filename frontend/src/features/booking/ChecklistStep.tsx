import { useId, useState } from 'react'
import { ANSWER_MAX, checklistProblem, todayIso } from '../../lib/booking'
import type { ChecklistItem } from '../../types/booking'

export interface ChecklistStepProps {
  items: ChecklistItem[]
  answers: Record<string, string | boolean>
  serverErrors?: Record<string, string>
  onAnswer: (itemId: string, answer: string) => void
}

const CHOICES: Record<'yes_no' | 'yes_no_unsure', { value: string; label: string }[]> = {
  yes_no: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ],
  yes_no_unsure: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'unsure', label: 'Not sure' },
  ],
}

interface ItemProps {
  item: ChecklistItem
  value: string
  error: string | undefined
  onAnswer: (itemId: string, answer: string) => void
  onTouch: (itemId: string) => void
}

function ChecklistQuestion({ item, value, error, onAnswer, onTouch }: ItemProps) {
  const id = useId()
  const helpId = item.help_text !== null ? `${id}-help` : undefined
  const errorId = error !== undefined ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  const required = item.is_required

  const footer = (
    <>
      {item.help_text !== null ? (
        <p id={helpId} className="field__hint">
          {item.help_text}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  )

  if (item.answer_type === 'yes_no' || item.answer_type === 'yes_no_unsure') {
    return (
      <fieldset className={`checklist-item${error !== undefined ? ' field--invalid' : ''}`} aria-describedby={describedBy}>
        <legend>
          {item.question}
          {required ? <span aria-hidden="true"> *</span> : <span className="checklist-item__optional"> (optional)</span>}
        </legend>
        <div className="choice-row">
          {CHOICES[item.answer_type].map((choice) => (
            <label key={choice.value} className={`choice${value === choice.value ? ' choice--active' : ''}`}>
              <input
                type="radio"
                name={`item-${item.id}`}
                value={choice.value}
                checked={value === choice.value}
                required={required}
                onChange={() => {
                  onAnswer(item.id, choice.value)
                  onTouch(item.id)
                }}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
        {footer}
      </fieldset>
    )
  }

  const isDate = item.answer_type === 'date'
  return (
    <div className={`checklist-item field${error !== undefined ? ' field--invalid' : ''}`}>
      <label htmlFor={id} className="field__label">
        {item.question}
        {required ? <span aria-hidden="true"> *</span> : <span className="checklist-item__optional"> (optional)</span>}
      </label>
      {isDate ? (
        <input
          id={id}
          type="date"
          className="field__input"
          value={value}
          max={todayIso()}
          min="1900-01-02"
          required={required}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          onChange={(event) => onAnswer(item.id, event.target.value)}
          onBlur={() => onTouch(item.id)}
        />
      ) : (
        <textarea
          id={id}
          className="field__input"
          rows={3}
          value={value}
          maxLength={ANSWER_MAX}
          required={required}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          onChange={(event) => onAnswer(item.id, event.target.value)}
          onBlur={() => onTouch(item.id)}
        />
      )}
      {footer}
    </div>
  )
}

export function ChecklistStep({ items, answers, serverErrors = {}, onAnswer }: ChecklistStepProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const touch = (itemId: string) => setTouched((previous) => ({ ...previous, [itemId]: true }))

  if (items.length === 0) {
    return <p>This scan has no extra safety questions. You can continue.</p>
  }

  return (
    <div className="checklist">
      {items.map((item) => {
        const raw = answers[item.id]
        const value = typeof raw === 'string' ? raw : ''
        const clientError = touched[item.id] ? checklistProblem(item, value) : null
        return (
          <ChecklistQuestion
            key={item.id}
            item={item}
            value={value}
            error={serverErrors[item.id] ?? clientError ?? undefined}
            onAnswer={onAnswer}
            onTouch={touch}
          />
        )
      })}
    </div>
  )
}
