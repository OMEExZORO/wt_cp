import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { useForm } from '../../hooks/useForm'
import { adminRules, composeAll } from '../../lib/adminValidation'
import { rules, type FieldValidator, type FormValue } from '../../lib/validation'
import { CheckboxField } from '../form/CheckboxField'
import { FormAlert } from '../form/FormAlert'
import { SelectField, type SelectOption } from '../form/SelectField'
import { SubmitButton } from '../form/SubmitButton'
import { TextAreaField } from '../form/TextAreaField'
import { TextField } from '../form/TextField'

export type FieldKind = 'text' | 'email' | 'tel' | 'url' | 'password' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'checkbox'

export interface FieldDef {
  name: string
  label: string
  kind?: FieldKind
  required?: boolean
  hint?: string
  placeholder?: string
  options?: SelectOption[]
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  rows?: number
  disabled?: boolean
  validators?: FieldValidator[]
}

export type FormValues = Record<string, FormValue>

export interface EntityFormProps {
  fields: FieldDef[]
  initialValues: FormValues
  submitLabel: string
  onSubmit: (values: FormValues) => Promise<void>
  onCancel?: () => void
  intro?: string
}

export function validatorFor(field: FieldDef): FieldValidator {
  const kind = field.kind ?? 'text'
  const parts: (FieldValidator | undefined)[] = []
  if (field.required === true && kind !== 'checkbox') {
    parts.push(rules.required())
  }
  if (kind === 'text' || kind === 'textarea' || kind === 'email' || kind === 'tel' || kind === 'url') {
    parts.push(rules.safe())
  }
  if (field.minLength !== undefined) {
    parts.push(rules.minLength(field.minLength))
  }
  if (kind === 'text' || kind === 'textarea' || kind === 'email' || kind === 'tel' || kind === 'url') {
    parts.push(rules.maxLength(field.maxLength ?? 255))
  }
  switch (kind) {
    case 'email':
      parts.push(rules.email())
      break
    case 'tel':
      parts.push(rules.phone())
      break
    case 'url':
      parts.push(adminRules.httpsUrl())
      break
    case 'password':
      parts.push(rules.password())
      break
    case 'number':
      parts.push(adminRules.integerBetween(field.min ?? 0, field.max ?? 100000))
      break
    case 'date':
      parts.push(adminRules.date())
      break
    case 'time':
      parts.push(adminRules.time())
      break
    case 'select':
      if (field.options !== undefined) {
        parts.push(rules.oneOf(field.options.map((option) => option.value)))
      }
      break
    default:
      break
  }
  parts.push(...(field.validators ?? []))
  return composeAll(...parts)
}

export function EntityForm({ fields, initialValues, submitLabel, onSubmit, onCancel, intro }: EntityFormProps) {
  const validators = useMemo(() => {
    const map: Record<string, FieldValidator> = {}
    for (const field of fields) {
      map[field.name] = validatorFor(field)
    }
    return map
  }, [fields])
  const form = useForm<FormValues>({ initialValues, validators })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      setFormError('Please correct the highlighted fields.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await onSubmit(form.trimmedValues())
    } catch (cause) {
      if (!mounted.current) {
        return
      }
      if (cause instanceof ApiError) {
        form.setServerErrors(cause.fields)
        setFormError(cause.fields._ ?? cause.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      if (mounted.current) {
        setBusy(false)
      }
    }
  }

  return (
    <form className="entity-form" onSubmit={(event) => void submit(event)} noValidate>
      {intro !== undefined ? <p className="muted">{intro}</p> : null}
      {formError !== null ? <FormAlert>{formError}</FormAlert> : null}
      <div className="entity-form__grid">
        {fields.map((field) => {
          const kind = field.kind ?? 'text'
          const wide = kind === 'textarea'
          return (
            <div key={field.name} className={wide ? 'entity-form__wide' : undefined}>
              {renderField(field, kind, form)}
            </div>
          )
        })}
      </div>
      <div className="entity-form__actions">
        {onCancel !== undefined ? (
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
        <SubmitButton loading={busy} loadingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  )
}

function renderField(field: FieldDef, kind: FieldKind, form: ReturnType<typeof useForm<FormValues>>) {
  const props = form.field(field.name)
  if (kind === 'checkbox') {
    const checkbox = form.checkbox(field.name)
    return (
      <CheckboxField {...checkbox} required={field.required}>
        {field.label}
      </CheckboxField>
    )
  }
  if (kind === 'textarea') {
    return <TextAreaField {...props} label={field.label} required={field.required} hint={field.hint} rows={field.rows} maxLength={field.maxLength} />
  }
  if (kind === 'select') {
    return <SelectField {...props} label={field.label} options={field.options ?? []} required={field.required} placeholder={field.required ? undefined : 'None'} />
  }
  const type = kind === 'number' ? 'text' : kind
  return (
    <TextField
      {...props}
      label={field.label}
      type={type}
      inputMode={kind === 'number' ? 'numeric' : undefined}
      required={field.required}
      hint={field.hint}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      disabled={field.disabled}
      autoComplete={kind === 'password' ? 'new-password' : 'off'}
    />
  )
}
