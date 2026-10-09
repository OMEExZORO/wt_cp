import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '../../api/admin'
import { ApiError } from '../../api/client'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { FormAlert } from '../../components/form/FormAlert'
import { useApiQuery } from '../../hooks/useApi'
import { formatDateTime } from '../../lib/format'
import { detectThreat } from '../../lib/validation'
import type { AdminReview, ReviewStatus } from '../../types/admin'

const FILTERS: { value: ReviewStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

const STATUS_LABEL: Record<ReviewStatus, string> = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' }

type Pending = { review: AdminReview; status: ReviewStatus } | null

export default function ReviewsModerationPage() {
  const [status, setStatus] = useState<ReviewStatus | ''>('pending')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<Pending>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const request = useCallback(() => adminApi.reviews({ page, per_page: 20, status }), [page, status])
  const { data, error, loading, reload } = useApiQuery(request, [request])

  const columns = useMemo<Column<AdminReview>[]>(
    () => [
      {
        key: 'review',
        header: 'Review',
        render: (review) => (
          <>
            <span aria-label={`${review.rating} out of 5 stars`} className="stars">
              {'★'.repeat(review.rating)}
              {'☆'.repeat(5 - review.rating)}
            </span>
            <p className="review-body">{review.body}</p>
            <p className="muted">
              {review.display_name}
              {review.verified_visit ? ' · Verified visit' : ''}
              {review.is_demo ? ' · Demo data' : ''}
            </p>
          </>
        ),
      },
      { key: 'created_at', header: 'Submitted', render: (review) => formatDateTime(review.created_at) },
      { key: 'status', header: 'Status', render: (review) => STATUS_LABEL[review.status] },
    ],
    [],
  )

  const open = (review: AdminReview, next: ReviewStatus) => {
    setNote('')
    setNoteError(null)
    setNotice(null)
    setPending({ review, status: next })
  }

  return (
    <section aria-labelledby="reviews-heading">
      <h1 id="reviews-heading">Review moderation</h1>
      <p className="muted">Only approved reviews are shown on the website. Reviews from patients with a completed visit are marked as verified.</p>
      <div role="group" aria-label="Filter by status" className="segmented">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className={`btn btn--sm ${status === filter.value ? 'btn--primary' : 'btn--outline'}`}
            aria-pressed={status === filter.value}
            onClick={() => {
              setStatus(filter.value)
              setPage(1)
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      <DataTable
        caption="Reviews"
        columns={columns}
        rows={data?.reviews ?? null}
        rowKey={(review) => review.id}
        loading={loading}
        error={error?.message ?? null}
        onRetry={() => void reload()}
        emptyMessage={status === 'pending' ? 'No reviews are waiting for moderation.' : 'No reviews match this filter.'}
        pagination={data?.pagination ?? null}
        onPageChange={setPage}
        actions={(review) => (
          <>
            {review.status !== 'approved' ? (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => open(review, 'approved')} aria-label={`Approve review by ${review.display_name}`}>
                Approve
              </button>
            ) : null}
            {review.status !== 'rejected' ? (
              <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => open(review, 'rejected')} aria-label={`Reject review by ${review.display_name}`}>
                Reject
              </button>
            ) : null}
          </>
        )}
      />
      {pending !== null ? (
        <ConfirmDialog
          title={pending.status === 'approved' ? 'Approve review' : 'Reject review'}
          confirmLabel={pending.status === 'approved' ? 'Approve and publish' : 'Reject'}
          tone={pending.status === 'approved' ? 'primary' : 'danger'}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            if (detectThreat(note) !== null || note.length > 500) {
              setNoteError('Keep the note under 500 characters and free of markup.')
              throw new ApiError(422, 'VALIDATION_FAILED', 'Please correct the internal note.')
            }
            await adminApi.moderateReview(pending.review.id, pending.status, note.trim() === '' ? undefined : note.trim())
            setPending(null)
            setNotice(pending.status === 'approved' ? 'The review is now public.' : 'The review was rejected and is not public.')
            await reload()
          }}
        >
          <blockquote className="review-quote">{pending.review.body}</blockquote>
          <div className={`field${noteError !== null ? ' field--invalid' : ''}`}>
            <label htmlFor="moderation-note" className="field__label">
              Internal note (optional)
            </label>
            <textarea id="moderation-note" className="field__input" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={noteError !== null} />
            {noteError !== null ? (
              <p className="field__error" role="alert">
                {noteError}
              </p>
            ) : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  )
}
