import type { ReactNode } from 'react'

export interface SubmitButtonProps {
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  children: ReactNode
}

export function SubmitButton({ disabled = false, loading = false, loadingText = 'Please wait…', children }: SubmitButtonProps) {
  return (
    <button type="submit" className="btn btn--primary" disabled={disabled || loading} aria-busy={loading}>
      {loading ? loadingText : children}
    </button>
  )
}
