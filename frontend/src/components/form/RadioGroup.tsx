import { useId, type ChangeEvent } from 'react'
import type { SelectOption } from './SelectField'

export interface RadioGroupProps {
  legend: string
  name: string
  value: string
  options: (SelectOption & { description?: string })[]
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function RadioGroup({ legend, name, value, options, onChange }: RadioGroupProps) {
  const groupId = useId()
  return (
    <fieldset className="radio-group">
      <legend>{legend}</legend>
      {options.map((option) => {
        const id = `${groupId}-${option.value}`
        return (
          <label key={option.value} htmlFor={id} className={`radio-card${value === option.value ? ' radio-card--active' : ''}`}>
            <input id={id} type="radio" name={name} value={option.value} checked={value === option.value} onChange={onChange} />
            <span className="radio-card__label">{option.label}</span>
            {option.description !== undefined ? <span className="radio-card__description">{option.description}</span> : null}
          </label>
        )
      })}
    </fieldset>
  )
}
