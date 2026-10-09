import { useCallback, useState, type ReactNode } from 'react'
import { useApiQuery } from '../../hooks/useApi'
import type { Pagination } from '../../types/admin'
import { FormAlert } from '../form/FormAlert'
import { ConfirmDialog } from './ConfirmDialog'
import { DataTable, type Column } from './DataTable'
import { EntityForm, type FieldDef, type FormValues } from './EntityForm'
import { Modal } from './Modal'

export interface CrudLoadResult<T> {
  rows: T[]
  pagination?: Pagination
}

export interface CrudPageProps<T extends { id: string }> {
  title: string
  entity: string
  description?: string
  columns: Column<T>[]
  fields: FieldDef[] | ((editing: T | null) => FieldDef[])
  load: (page: number) => Promise<CrudLoadResult<T>>
  toForm: (row: T | null) => FormValues
  rowName: (row: T) => string
  create?: (values: FormValues) => Promise<unknown>
  update?: (row: T, values: FormValues) => Promise<unknown>
  remove?: (row: T) => Promise<unknown>
  extraActions?: (row: T) => ReactNode
  toolbar?: ReactNode
  deps?: unknown[]
  headingLevel?: 1 | 2
  emptyMessage?: string
}

type Dialog<T> = { kind: 'create' } | { kind: 'edit'; row: T } | { kind: 'delete'; row: T } | null

export function CrudPage<T extends { id: string }>({
  title,
  entity,
  description,
  columns,
  fields,
  load,
  toForm,
  rowName,
  create,
  update,
  remove,
  extraActions,
  toolbar,
  deps = [],
  headingLevel = 1,
  emptyMessage,
}: CrudPageProps<T>) {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog<T>>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const request = useCallback(() => load(page), [load, page])
  const { data, error, loading, reload } = useApiQuery(request, [page, request, ...deps])

  const refresh = useCallback(() => {
    void reload()
  }, [reload])
  const closeAndRefresh = (message: string) => {
    setDialog(null)
    setNotice(message)
    refresh()
  }
  const resolvedFields = (row: T | null): FieldDef[] => (typeof fields === 'function' ? fields(row) : fields)
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const hasActions = update !== undefined || remove !== undefined || extraActions !== undefined

  return (
    <section aria-labelledby={`${entity}-heading`} className="crud">
      <div className="crud__header">
        <div>
          <Heading id={`${entity}-heading`}>{title}</Heading>
          {description !== undefined ? <p className="muted">{description}</p> : null}
        </div>
        {create !== undefined ? (
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ kind: 'create' })}>
            Add {entity}
          </button>
        ) : null}
      </div>
      {toolbar}
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      <DataTable
        caption={title}
        columns={columns}
        rows={data?.rows ?? null}
        rowKey={(row) => row.id}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refresh}
        emptyMessage={emptyMessage ?? `No ${entity} records yet.`}
        pagination={data?.pagination ?? null}
        onPageChange={setPage}
        actions={
          hasActions
            ? (row) => (
                <>
                  {update !== undefined ? (
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => setDialog({ kind: 'edit', row })} aria-label={`Edit ${rowName(row)}`}>
                      Edit
                    </button>
                  ) : null}
                  {extraActions?.(row)}
                  {remove !== undefined ? (
                    <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => setDialog({ kind: 'delete', row })} aria-label={`Delete ${rowName(row)}`}>
                      Delete
                    </button>
                  ) : null}
                </>
              )
            : undefined
        }
      />

      {dialog?.kind === 'create' && create !== undefined ? (
        <Modal title={`Add ${entity}`} onClose={() => setDialog(null)} wide>
          <EntityForm
            fields={resolvedFields(null)}
            initialValues={toForm(null)}
            submitLabel={`Add ${entity}`}
            onCancel={() => setDialog(null)}
            onSubmit={async (values) => {
              await create(values)
              closeAndRefresh(`The ${entity} was added.`)
            }}
          />
        </Modal>
      ) : null}

      {dialog?.kind === 'edit' && update !== undefined ? (
        <Modal title={`Edit ${entity}`} onClose={() => setDialog(null)} wide>
          <EntityForm
            key={dialog.row.id}
            fields={resolvedFields(dialog.row)}
            initialValues={toForm(dialog.row)}
            submitLabel="Save changes"
            onCancel={() => setDialog(null)}
            onSubmit={async (values) => {
              await update(dialog.row, values)
              closeAndRefresh(`The ${entity} was updated.`)
            }}
          />
        </Modal>
      ) : null}

      {dialog?.kind === 'delete' && remove !== undefined ? (
        <ConfirmDialog
          title={`Delete ${entity}`}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            await remove(dialog.row)
            closeAndRefresh(`The ${entity} was deleted.`)
          }}
        >
          <p>
            Delete <strong>{rowName(dialog.row)}</strong>? This cannot be undone. Records that are still in use cannot be deleted; deactivate them instead.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  )
}
