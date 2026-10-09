import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { adminApi } from '../../api/admin'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { useApiQuery } from '../../hooks/useApi'
import { formatDateTime } from '../../lib/format'
import { ROLE_LABEL } from '../../lib/roles'
import { detectThreat } from '../../lib/validation'
import type { AuditEntry } from '../../types/admin'
import type { Role } from '../../types/auth'

interface Filters {
  action: string
  actor_role: string
  entity_type: string
  from: string
  to: string
}

const EMPTY: Filters = { action: '', actor_role: '', entity_type: '', from: '', to: '' }
const ACTION_PATTERN = /^[a-z_]+(\.[a-z_]+)*$/
const ENTITY_PATTERN = /^[a-z_]+$/

export function filterProblems(filters: Filters): Partial<Record<keyof Filters, string>> {
  const problems: Partial<Record<keyof Filters, string>> = {}
  if (filters.action !== '' && (!ACTION_PATTERN.test(filters.action) || detectThreat(filters.action) !== null)) {
    problems.action = 'Use lowercase letters, dots and underscores, for example admin.faq_created.'
  }
  if (filters.entity_type !== '' && !ENTITY_PATTERN.test(filters.entity_type)) {
    problems.entity_type = 'Use lowercase letters and underscores.'
  }
  if (filters.from !== '' && filters.to !== '' && filters.to < filters.from) {
    problems.to = 'The end date must not be before the start date.'
  }
  return problems
}

export default function AuditLogPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY)
  const [applied, setApplied] = useState<Filters>(EMPTY)
  const [problems, setProblems] = useState<Partial<Record<keyof Filters, string>>>({})
  const [page, setPage] = useState(1)

  const request = useCallback(() => adminApi.auditLog({ page, per_page: 25, ...applied }), [page, applied])
  const { data, error, loading, reload } = useApiQuery(request, [request])

  const columns = useMemo<Column<AuditEntry>[]>(
    () => [
      { key: 'created_at', header: 'When', render: (entry) => formatDateTime(entry.created_at) },
      { key: 'actor', header: 'Who', render: (entry) => (entry.actor_name !== null ? `${entry.actor_name} (${entry.actor_role ? ROLE_LABEL[entry.actor_role as Role] : 'unknown'})` : 'System or guest') },
      { key: 'action', header: 'Action' },
      { key: 'entity', header: 'Record', render: (entry) => (entry.entity_type !== null ? `${entry.entity_type} ${entry.entity_id ?? ''}`.trim() : '-') },
      { key: 'ip_address', header: 'IP address' },
      {
        key: 'metadata',
        header: 'Details',
        render: (entry) =>
          Object.keys(entry.metadata).length === 0 ? (
            <span className="muted">-</span>
          ) : (
            <details>
              <summary>View</summary>
              <pre className="audit-json">{JSON.stringify(entry.metadata, null, 2)}</pre>
            </details>
          ),
      },
    ],
    [],
  )

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const found = filterProblems(draft)
    setProblems(found)
    if (Object.keys(found).length === 0) {
      setPage(1)
      setApplied(draft)
    }
  }
  const set = (name: keyof Filters) => (event: { target: { value: string } }) => setDraft((previous) => ({ ...previous, [name]: event.target.value }))

  return (
    <section aria-labelledby="audit-heading">
      <h1 id="audit-heading">Audit log</h1>
      <p className="muted">Every administrative change and security event is recorded here. Entries cannot be edited.</p>
      <form className="filters filters--form" onSubmit={apply} noValidate>
        <label>
          <span className="filters__label">Action starts with</span>
          <input className="field__input" value={draft.action} onChange={set('action')} placeholder="admin.faq" maxLength={80} aria-invalid={problems.action !== undefined} aria-describedby={problems.action ? 'audit-action-error' : undefined} />
          {problems.action ? (
            <span id="audit-action-error" className="field__error" role="alert">
              {problems.action}
            </span>
          ) : null}
        </label>
        <label>
          <span className="filters__label">Role</span>
          <select className="field__input" value={draft.actor_role} onChange={set('actor_role')}>
            <option value="">Any role</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="filters__label">Record type</span>
          <input className="field__input" value={draft.entity_type} onChange={set('entity_type')} placeholder="faq" maxLength={60} aria-invalid={problems.entity_type !== undefined} />
          {problems.entity_type ? (
            <span className="field__error" role="alert">
              {problems.entity_type}
            </span>
          ) : null}
        </label>
        <label>
          <span className="filters__label">From</span>
          <input type="date" className="field__input" value={draft.from} onChange={set('from')} />
        </label>
        <label>
          <span className="filters__label">To</span>
          <input type="date" className="field__input" value={draft.to} onChange={set('to')} aria-invalid={problems.to !== undefined} />
          {problems.to ? (
            <span className="field__error" role="alert">
              {problems.to}
            </span>
          ) : null}
        </label>
        <div className="filters__buttons">
          <button type="submit" className="btn btn--primary btn--sm">
            Apply filters
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => {
              setDraft(EMPTY)
              setApplied(EMPTY)
              setProblems({})
              setPage(1)
            }}
          >
            Clear
          </button>
        </div>
      </form>
      <DataTable
        caption="Audit log"
        columns={columns}
        rows={data?.entries ?? null}
        rowKey={(entry) => String(entry.id)}
        loading={loading}
        error={error?.message ?? null}
        onRetry={() => void reload()}
        emptyMessage="No entries match these filters."
        pagination={data?.pagination ?? null}
        onPageChange={setPage}
      />
    </section>
  )
}
