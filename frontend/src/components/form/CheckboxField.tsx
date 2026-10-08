import { useId, type ChangeEvent, type FocusEvent, type ReactNode } from 'react'

export interface CheckboxFieldProps {
  name: string
  checked: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  error?: string
  required?: boolean
  children: ReactNode
}

export function CheckboxField({ name, checked, onChange, onBlur, error, required, children }: CheckboxFieldProps) {
  const id = `${name}-${useId()}`
  const errorId = error !== undefined ? `${id}-error` : undefined
  return (
    <div className={`field field--checkbox${error !== undefined ? ' field--invalid' : ''}`}>
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={errorId}
      />
      <label htmlFor={id}>{children}</label>
      {error !== undefined ? (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
