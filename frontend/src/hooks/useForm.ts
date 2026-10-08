import { useCallback, useMemo, useReducer, type ChangeEvent, type FocusEvent } from 'react'
import { normalise, type FieldValidator, type FormValue } from '../lib/validation'

type Values = Record<string, FormValue>

interface FormState<T extends Values> {
  values: T
  touched: Partial<Record<keyof T, boolean>>
  serverErrors: Record<string, string>
}

type FormAction<T extends Values> =
  | { type: 'change'; name: keyof T; value: FormValue }
  | { type: 'blur'; name: keyof T }
  | { type: 'touchAll' }
  | { type: 'serverErrors'; errors: Record<string, string> }
  | { type: 'reset'; values: T }

function reducer<T extends Values>(state: FormState<T>, action: FormAction<T>): FormState<T> {
  switch (action.type) {
    case 'change': {
      const serverErrors = { ...state.serverErrors }
      delete serverErrors[action.name as string]
      return { ...state, values: { ...state.values, [action.name]: action.value }, serverErrors }
    }
    case 'blur':
      return { ...state, touched: { ...state.touched, [action.name]: true } }
    case 'touchAll': {
      const touched: Partial<Record<keyof T, boolean>> = {}
      for (const key of Object.keys(state.values) as (keyof T)[]) {
        touched[key] = true
      }
      return { ...state, touched }
    }
    case 'serverErrors':
      return { ...state, serverErrors: action.errors }
    case 'reset':
      return { values: action.values, touched: {}, serverErrors: {} }
  }
}

export interface UseFormOptions<T extends Values> {
  initialValues: T
  validators?: Partial<Record<keyof T, FieldValidator>>
}

export interface FieldProps {
  name: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onBlur: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  error: string | undefined
}

export interface CheckboxProps {
  name: string
  checked: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur: (event: FocusEvent<HTMLInputElement>) => void
  error: string | undefined
}

export function useForm<T extends Values>({ initialValues, validators = {} }: UseFormOptions<T>) {
  const [state, dispatch] = useReducer(reducer<T>, { values: initialValues, touched: {}, serverErrors: {} })

  const clientErrors = useMemo(() => {
    const errors: Partial<Record<keyof T, string>> = {}
    for (const key of Object.keys(validators) as (keyof T)[]) {
      const validator = validators[key]
      if (validator === undefined) {
        continue
      }
      const message = validator(state.values[key], state.values)
      if (message !== null) {
        errors[key] = message
      }
    }
    return errors
  }, [state.values, validators])

  const errors = useMemo(() => {
    const visible: Record<string, string> = {}
    for (const key of Object.keys(clientErrors) as (keyof T)[]) {
      const message = clientErrors[key]
      if (state.touched[key] && message !== undefined) {
        visible[key as string] = message
      }
    }
    return { ...visible, ...state.serverErrors }
  }, [clientErrors, state.touched, state.serverErrors])

  const isValid = Object.keys(clientErrors).length === 0

  const setValue = useCallback((name: keyof T, value: FormValue) => dispatch({ type: 'change', name, value }), [])

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = event.target
    const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value
    dispatch({ type: 'change', name: target.name as keyof T, value })
  }, [])

  const handleBlur = useCallback((event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    dispatch({ type: 'blur', name: event.target.name as keyof T })
  }, [])

  const field = useCallback(
    (name: keyof T & string): FieldProps => ({
      name,
      value: String(state.values[name] ?? ''),
      onChange: handleChange,
      onBlur: handleBlur,
      error: errors[name],
    }),
    [state.values, errors, handleChange, handleBlur],
  )

  const checkbox = useCallback(
    (name: keyof T & string): CheckboxProps => ({
      name,
      checked: state.values[name] === true,
      onChange: handleChange,
      onBlur: handleBlur,
      error: errors[name],
    }),
    [state.values, errors, handleChange, handleBlur],
  )

  const trimmedValues = useCallback((): T => {
    const result = { ...state.values }
    for (const key of Object.keys(result) as (keyof T)[]) {
      const value = result[key]
      if (typeof value === 'string' && !(key as string).toLowerCase().includes('password')) {
        result[key] = normalise(value) as T[keyof T]
      }
    }
    return result
  }, [state.values])

  return {
    values: state.values,
    errors,
    isValid,
    field,
    checkbox,
    setValue,
    trimmedValues,
    touchAll: useCallback(() => dispatch({ type: 'touchAll' }), []),
    setServerErrors: useCallback((serverErrors: Record<string, string>) => dispatch({ type: 'serverErrors', errors: serverErrors }), []),
    reset: useCallback((values: T) => dispatch({ type: 'reset', values }), []),
  }
}
