import type { FormValue } from './validation'

export type Values = Record<string, FormValue>

export function str(values: Values, name: string): string {
  const value = values[name]
  return typeof value === 'string' ? value : ''
}

export function nullable(values: Values, name: string): string | null {
  const value = str(values, name).trim()
  return value === '' ? null : value
}

export function int(values: Values, name: string, fallback = 0): number {
  const value = str(values, name).trim()
  return value === '' ? fallback : Number.parseInt(value, 10)
}

export function flag(values: Values, name: string): boolean {
  return values[name] === true
}

export function text(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}
