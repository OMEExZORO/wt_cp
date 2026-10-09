import { useState, type ReactNode } from 'react'
import { ApiError } from '../../api/client'
import { FormAlert } from '../form/FormAlert'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  title: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  onConfirm: () => Promise<void>
  onCancel: () => void
  children: ReactNode
}

export function ConfirmDialog({ title, confirmLabel, tone = 'primary', onConfirm, onCancel, children }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm">
        {error !== null ? <FormAlert>{error}</FormAlert> : null}
        <div>{children}</div>
        <div className="confirm__actions">
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`} onClick={() => void confirm()} disabled={busy} aria-busy={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
