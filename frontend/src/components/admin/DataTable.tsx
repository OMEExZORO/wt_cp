import type { ReactNode } from 'react'
import type { Pagination as PaginationMeta } from '../../types/admin'
import { Pagination } from './Pagination'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

export interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[] | null
  rowKey: (row: T) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyMessage?: string
  actions?: (row: T) => ReactNode
  pagination?: PaginationMeta | null
  onPageChange?: (page: number) => void
}

function cell<T>(column: Column<T>, row: T): ReactNode {
  if (column.render !== undefined) {
    return column.render(row)
  }
  const value = (row as Record<string, unknown>)[column.key]
  if (value === null || value === undefined || value === '') {
    return <span className="muted">-</span>
  }
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'Nothing to show yet.',
  actions,
  pagination = null,
  onPageChange,
}: DataTableProps<T>) {
  if (error !== null) {
    return (
      <div className="alert alert--error" role="alert">
        <p>{error}</p>
        {onRetry !== undefined ? (
          <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    )
  }
  if (loading && rows === null) {
    return (
      <div className="page-loader" role="status" aria-live="polite">
        <span className="page-loader__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    )
  }
  if (rows !== null && rows.length === 0) {
    return (
      <div className="empty-state" role="status">
        <p>{emptyMessage}</p>
      </div>
    )
  }
  const items = rows ?? []

  return (
    <div className="data-table" aria-busy={loading}>
      <div className="data-table__scroll">
        <table>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={column.className}>
                  {column.header}
                </th>
              ))}
              {actions !== undefined ? (
                <th scope="col" className="data-table__actions">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className} data-label={column.header}>
                    {cell(column, row)}
                  </td>
                ))}
                {actions !== undefined ? (
                  <td className="data-table__actions" data-label="Actions">
                    <div className="data-table__buttons">{actions(row)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination !== null && onPageChange !== undefined ? <Pagination {...pagination} onPageChange={onPageChange} /> : null}
    </div>
  )
}
