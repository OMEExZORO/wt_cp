import { useId, type ChangeEvent, type FocusEvent } from 'react'

export interface TextAreaFieldProps {
  label: string
  name: string
  value: string
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void
  error?: string
  hint?: string
  required?: boolean
  rows?: number
  maxLength?: number
}

export function TextAreaField({ label, name, value, onChange, onBlur, error, hint, required, rows = 4, maxLength }: TextAreaFieldProps) {
  const id = `${name}-${useId()}`
  const hintId = hint !== undefined ? `${id}-hint` : undefined
  const errorId = error !== undefined ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field${error !== undefined ? ' field--invalid' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className="field__input"
      />
      {hint !== undefined ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
