import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '../../api/admin'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { EntityForm, type FieldDef } from '../../components/admin/EntityForm'
import { Modal } from '../../components/admin/Modal'
import { FormAlert } from '../../components/form/FormAlert'
import { useApiQuery } from '../../hooks/useApi'
import { flag, int, nullable, str } from '../../lib/adminForm'
import { formatDate, todayIso } from '../../lib/format'
import type { AdminSlot } from '../../types/admin'

const MODALITIES = [
  { value: 'USG', label: 'Ultrasound (USG)' },
  { value: 'CT', label: 'CT' },
  { value: 'BIOPSY', label: 'Image-guided biopsy' },
]

type Dialog = { kind: 'capacity'; slot: AdminSlot } | { kind: 'block'; slot: AdminSlot } | { kind: 'delete'; slot: AdminSlot } | { kind: 'generate' } | null

const closedWeekdays = (value: string | boolean) =>
  typeof value === 'string' && value.trim() !== '' && !/^[1-7](,[1-7]){0,6}$/.test(value.replace(/\s/g, '')) ? 'Use weekday numbers 1 to 7 separated by commas, for example 7.' : null

const generateFields = (branches: { value: string; label: string }[]): FieldDef[] => [
  { name: 'from', label: 'First day', kind: 'date', required: true },
  { name: 'days', label: 'Number of days', kind: 'number', required: true, min: 1, max: 90 },
  { name: 'open', label: 'Opens at', kind: 'time', required: true },
  { name: 'close', label: 'Closes at', kind: 'time', required: true },
  { name: 'interval', label: 'Slot length (minutes)', kind: 'number', required: true, min: 5, max: 240 },
  { name: 'branch_id', label: 'Branch', kind: 'select', options: branches, hint: 'Leave empty for every active branch.' },
  { name: 'capacity_usg', label: 'Patients per slot: ultrasound', kind: 'number', min: 0, max: 50 },
  { name: 'capacity_ct', label: 'Patients per slot: CT', kind: 'number', min: 0, max: 50 },
  { name: 'capacity_biopsy', label: 'Patients per slot: biopsy', kind: 'number', min: 0, max: 50 },
  { name: 'closed_weekdays', label: 'Closed weekdays', hint: '1 is Monday and 7 is Sunday. Separate with commas.', validators: [closedWeekdays] },
  { name: 'dry_run', label: 'Preview only, do not create slots', kind: 'checkbox' },
]

export default function SlotsPage() {
  const [branchId, setBranchId] = useState('')
  const [modality, setModality] = useState('')
  const [date, setDate] = useState(todayIso())
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data: branchData } = useApiQuery(() => adminApi.branches(), [])
  const branchOptions = useMemo(() => (branchData?.branches ?? []).map((branch) => ({ value: branch.id, label: branch.name })), [branchData])

  const request = useCallback(() => adminApi.slots({ page, per_page: 100, branch_id: branchId, modality, date }), [page, branchId, modality, date])
  const { data, error, loading, reload } = useApiQuery(request, [request])
  const refresh = () => void reload()
  const done = (message: string) => {
    setDialog(null)
    setNotice(message)
    refresh()
  }

  const columns = useMemo<Column<AdminSlot>[]>(
    () => [
      { key: 'time', header: 'Time', render: (slot) => `${slot.start_time} to ${slot.end_time}` },
      { key: 'slot_date', header: 'Date', render: (slot) => formatDate(slot.slot_date) },
      { key: 'branch_name', header: 'Branch' },
      { key: 'modality', header: 'Modality' },
      { key: 'booked', header: 'Booked', render: (slot) => `${slot.booked_count} of ${slot.capacity}` },
      { key: 'is_blocked', header: 'Status', render: (slot) => (slot.is_blocked ? 'Blocked' : slot.booked_count >= slot.capacity ? 'Full' : 'Open') },
    ],
    [],
  )

  return (
    <section aria-labelledby="slots-heading" className="crud">
      <div className="crud__header">
        <div>
          <h1 id="slots-heading">Slots and capacity</h1>
          <p className="muted">Change how many patients a slot takes, block a slot, or create slots in bulk. Existing slots are never overwritten.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setDialog({ kind: 'generate' })}>
          Generate slots
        </button>
      </div>
      <div className="filters">
        <label>
          <span className="filters__label">Branch</span>
          <select
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value)
              setPage(1)
            }}
            className="field__input"
          >
            <option value="">All branches</option>
            {branchOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="filters__label">Modality</span>
          <select
            value={modality}
            onChange={(event) => {
              setModality(event.target.value)
              setPage(1)
            }}
            className="field__input"
          >
            <option value="">All</option>
            {MODALITIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="filters__label">Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setPage(1)
            }}
            className="field__input"
          />
        </label>
      </div>
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      <DataTable
        caption="Slots"
        columns={columns}
        rows={data?.slots ?? null}
        rowKey={(slot) => slot.id}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refresh}
        emptyMessage="No slots match these filters. Generate slots to open this day for booking."
        pagination={data?.pagination ?? null}
        onPageChange={setPage}
        actions={(slot) => (
          <>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setDialog({ kind: 'capacity', slot })} aria-label={`Change capacity of ${slot.start_time} ${slot.modality} slot`}>
              Capacity
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setDialog({ kind: 'block', slot })} aria-label={`${slot.is_blocked ? 'Unblock' : 'Block'} ${slot.start_time} ${slot.modality} slot`}>
              {slot.is_blocked ? 'Unblock' : 'Block'}
            </button>
            {slot.booked_count === 0 ? (
              <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => setDialog({ kind: 'delete', slot })} aria-label={`Delete ${slot.start_time} ${slot.modality} slot`}>
                Delete
              </button>
            ) : null}
          </>
        )}
      />

      {dialog?.kind === 'capacity' ? (
        <Modal title="Change slot capacity" onClose={() => setDialog(null)}>
          <EntityForm
            fields={[{ name: 'capacity', label: `Patients per slot (currently ${dialog.slot.booked_count} booked)`, kind: 'number', required: true, min: Math.max(1, dialog.slot.booked_count), max: 50 }]}
            initialValues={{ capacity: String(dialog.slot.capacity) }}
            submitLabel="Save capacity"
            onCancel={() => setDialog(null)}
            onSubmit={async (values) => {
              await adminApi.updateSlot(dialog.slot.id, { capacity: int(values, 'capacity', dialog.slot.capacity) })
              done('The slot capacity was updated.')
            }}
          />
        </Modal>
      ) : null}

      {dialog?.kind === 'block' ? (
        <ConfirmDialog
          title={dialog.slot.is_blocked ? 'Unblock slot' : 'Block slot'}
          confirmLabel={dialog.slot.is_blocked ? 'Unblock' : 'Block'}
          tone={dialog.slot.is_blocked ? 'primary' : 'danger'}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            await adminApi.updateSlot(dialog.slot.id, { is_blocked: !dialog.slot.is_blocked })
            done(dialog.slot.is_blocked ? 'The slot is open for booking again.' : 'The slot is blocked. Existing bookings are not cancelled.')
          }}
        >
          <p>
            {dialog.slot.is_blocked ? 'Open' : 'Block'} the {dialog.slot.start_time} {dialog.slot.modality} slot on {formatDate(dialog.slot.slot_date)} at {dialog.slot.branch_name}?
          </p>
        </ConfirmDialog>
      ) : null}

      {dialog?.kind === 'delete' ? (
        <ConfirmDialog
          title="Delete slot"
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            await adminApi.deleteSlot(dialog.slot.id)
            done('The slot was deleted.')
          }}
        >
          <p>
            Delete the {dialog.slot.start_time} {dialog.slot.modality} slot on {formatDate(dialog.slot.slot_date)}? Slots with bookings cannot be deleted.
          </p>
        </ConfirmDialog>
      ) : null}

      {dialog?.kind === 'generate' ? (
        <Modal title="Generate slots" onClose={() => setDialog(null)} wide>
          <EntityForm
            fields={generateFields(branchOptions)}
            initialValues={{
              from: todayIso(),
              days: '14',
              open: '09:00',
              close: '17:00',
              interval: '30',
              branch_id: '',
              capacity_usg: '2',
              capacity_ct: '1',
              capacity_biopsy: '1',
              closed_weekdays: '7',
              dry_run: true,
            }}
            submitLabel="Run"
            intro="Preview first to see how many slots would be created."
            onCancel={() => setDialog(null)}
            onSubmit={async (values) => {
              const result = await adminApi.generateSlots({
                from: str(values, 'from'),
                days: int(values, 'days', 1),
                open: str(values, 'open'),
                close: str(values, 'close'),
                interval: int(values, 'interval', 30),
                branch_id: nullable(values, 'branch_id'),
                capacity_usg: int(values, 'capacity_usg'),
                capacity_ct: int(values, 'capacity_ct'),
                capacity_biopsy: int(values, 'capacity_biopsy'),
                closed_weekdays: nullable(values, 'closed_weekdays'),
                dry_run: flag(values, 'dry_run'),
              })
              done(
                result.dry_run
                  ? `Preview: ${result.candidates} slots would be considered.`
                  : `Created ${result.inserted} new slots; ${result.skipped_existing} already existed.`,
              )
            }}
          />
        </Modal>
      ) : null}
    </section>
  )
}
