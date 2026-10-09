import { forwardRef, useId, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur' | 'value'> {
  label: string
  name: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  error?: string
  hint?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, name, value, onChange, onBlur, error, hint, required, type = 'text', id, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? `${name}-${generatedId}`
  const hintId = hint !== undefined ? `${inputId}-hint` : undefined
  const errorId = error !== undefined ? `${inputId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`field${error !== undefined ? ' field--invalid' : ''}`}>
      <label htmlFor={inputId} className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        ref={ref}
        id={inputId}
        name={name}
        type={type}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className="field__input"
        {...rest}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
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
})
