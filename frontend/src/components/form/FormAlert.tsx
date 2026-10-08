import type { ReactNode } from 'react'

export interface FormAlertProps {
  tone?: 'error' | 'success' | 'info'
  children: ReactNode
}

export function FormAlert({ tone = 'error', children }: FormAlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
