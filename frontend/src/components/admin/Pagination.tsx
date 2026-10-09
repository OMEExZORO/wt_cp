export interface PaginationProps {
  page: number
  per_page: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, per_page, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / per_page))
  if (pages <= 1) {
    return (
      <p className="pagination__summary" role="status">
        {total} {total === 1 ? 'record' : 'records'}
      </p>
    )
  }
  const first = (page - 1) * per_page + 1
  const last = Math.min(total, page * per_page)
  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination__summary" role="status">
        Showing {first} to {last} of {total}
      </p>
      <div className="pagination__buttons">
        <button type="button" className="btn btn--outline btn--sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <span aria-current="page">
          Page {page} of {pages}
        </span>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages}>
          Next
        </button>
      </div>
    </nav>
  )
}
