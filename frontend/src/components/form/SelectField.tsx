import { useId, type ChangeEvent, type FocusEvent } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  label: string
  name: string
  value: string
  options: SelectOption[]
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
  onBlur?: (event: FocusEvent<HTMLSelectElement>) => void
  error?: string
  required?: boolean
  placeholder?: string
}

export function SelectField({ label, name, value, options, onChange, onBlur, error, required, placeholder }: SelectFieldProps) {
  const id = `${name}-${useId()}`
  const errorId = error !== undefined ? `${id}-error` : undefined
  return (
    <div className={`field${error !== undefined ? ' field--invalid' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={errorId}
        className="field__input"
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error !== undefined ? (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
