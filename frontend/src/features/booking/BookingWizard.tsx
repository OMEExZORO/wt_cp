import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { bookingsApi } from '../../api/bookings'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { FormAlert } from '../../components/form/FormAlert'
import { CheckboxField } from '../../components/form/CheckboxField'
import { RadioGroup } from '../../components/form/RadioGroup'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextField } from '../../components/form/TextField'
import { PageLoader } from '../../components/PageLoader'
import { usePublicResource } from '../../hooks/usePublicResource'
import { MODALITY_OPTIONS, readBookPrefill } from '../../lib/prefill'
import { NOTES_MAX, checklistErrors, describeBookingError, formatDate, formatSlotRange, notesProblem, type BookingFailure } from '../../lib/booking'
import type { ChecklistResponse, Slot, SlotSuggestion } from '../../types/booking'
import type { PublicBranch, PublicScanType } from '../../types/public'
import { branchSelected, checklistAnswered, draftReset, draftUpdated, scanSelected, slotChosen, stepChanged } from './bookingSlice'
import { ChecklistStep } from './ChecklistStep'
import { SlotPicker } from './SlotPicker'
import { SuggestionBanner } from './SuggestionBanner'

export const STEP_TITLES = ['Choose a branch', 'Choose a scan', 'Pick a date and time', 'Safety checklist', 'Review and confirm'] as const

const LAST_STEP = STEP_TITLES.length - 1

export interface ScanSearchProps {
  scans: PublicScanType[]
  query: string
  selected: string | null
  onQueryChange: (query: string) => void
  onSelect: (scanId: string) => void
}

export function filterBookableScans(scans: PublicScanType[], query: string): PublicScanType[] {
  const needle = query.trim().toLowerCase()
  return scans.filter(
    (scan) => scan.is_bookable_online && (needle === '' || `${scan.name} ${scan.modality} ${scan.category.name}`.toLowerCase().includes(needle)),
  )
}

export function ScanSearch({ scans, query, selected, onQueryChange, onSelect }: ScanSearchProps) {
  const results = useMemo(() => filterBookableScans(scans, query), [scans, query])
  return (
    <div>
      <TextField
        label="Search scans"
        name="scan-search"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        hint="Type a scan name such as CT brain or dating scan."
        autoComplete="off"
        maxLength={80}
      />
      <p className="results-count" role="status">
        {results.length} {results.length === 1 ? 'scan' : 'scans'} found
      </p>
      {results.length === 0 ? (
        <p>
          No scan matches your search. Some scans cannot be booked online, please <Link to="/contact">contact the centre</Link>.
        </p>
      ) : (
        <div className="scan-list">
          <RadioGroup
            legend="Scan type"
            name="scan_type_id"
            value={selected ?? ''}
            onChange={(event) => onSelect(event.target.value)}
            options={results.map((scan) => ({ value: scan.id, label: scan.name, description: `${scan.category.name}` }))}
          />
        </div>
      )}
    </div>
  )
}

export default function BookingWizard() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { draft, step } = useAppSelector((state) => state.booking)
  const branches = usePublicResource('branches')
  const scanTypes = usePublicResource('scanTypes')
  const [query, setQuery] = useState('')
  const [searchParams] = useSearchParams()
  const prefill = useMemo(() => readBookPrefill(searchParams), [searchParams])
  const [modality, setModality] = useState(prefill.modality)
  const prefilled = useRef(false)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [checklist, setChecklist] = useState<{ data: ChecklistResponse | null; loading: boolean; error: string | null }>({
    data: null,
    loading: false,
    error: null,
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<BookingFailure | null>(null)
  const [checklistServerErrors, setChecklistServerErrors] = useState<Record<string, string>>({})
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const branchList: PublicBranch[] = branches.data?.branches ?? []
  const scanList: PublicScanType[] = scanTypes.data?.scan_types ?? []
  const branch = branchList.find((candidate) => candidate.id === draft.branch_id) ?? null
  const modalityScans = modality === null ? scanList : scanList.filter((candidate) => candidate.modality === modality)
  const scan = scanList.find((candidate) => candidate.id === draft.scan_type_id) ?? null

  useEffect(() => {
    if (prefilled.current || prefill.branch === null) {
      return
    }
    const match = branchList.find((candidate) => candidate.slug === prefill.branch)
    if (match !== undefined) {
      prefilled.current = true
      dispatch(branchSelected(match.id))
      dispatch(stepChanged(prefill.modality !== null ? 1 : 0))
    }
  }, [branchList, prefill, dispatch])

  useEffect(() => {
    if (step > 2) {
      dispatch(stepChanged(2))
    }
  }, [])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const scanId = draft.scan_type_id
  useEffect(() => {
    if (scanId === null) {
      setChecklist({ data: null, loading: false, error: null })
      return
    }
    let cancelled = false
    setChecklist({ data: null, loading: true, error: null })
    bookingsApi
      .checklist(scanId)
      .then((data) => {
        if (!cancelled) {
          setChecklist({ data, loading: false, error: null })
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setChecklist({ data: null, loading: false, error: describeBookingError(cause).message })
        }
      })
    return () => {
      cancelled = true
    }
  }, [scanId])

  const items = checklist.data?.items ?? []
  const clientChecklistErrors = useMemo(() => checklistErrors(items, draft.checklist), [items, draft.checklist])
  const notesError = notesProblem(draft.notes)

  const stepValid = [
    draft.branch_id !== null,
    draft.scan_type_id !== null,
    draft.slot_id !== null && slot !== null && draft.date !== null,
    checklist.data !== null && Object.keys(clientChecklistErrors).length === 0,
    draft.consent && notesError === null && draft.slot_id !== null,
  ]
  const canBook = stepValid.every(Boolean) && !submitting

  const goTo = useCallback((next: number) => dispatch(stepChanged(next)), [dispatch])

  const applySuggestion = (suggestion: SlotSuggestion) => {
    dispatch(slotChosen({ branchId: suggestion.branch.id, date: suggestion.slot.date, slotId: suggestion.slot.id }))
    setSlot(suggestion.slot)
    setFailure(null)
  }

  const onDateChange = (date: string) => {
    dispatch(slotChosen({ date, slotId: null }))
    setSlot(null)
  }

  const onSlotChange = useCallback(
    (next: Slot | null) => {
      setSlot(next)
      dispatch(slotChosen({ date: next?.date ?? '', slotId: next?.id ?? null }))
    },
    [dispatch],
  )

  const onSlotPicked = (next: Slot | null) => {
    if (next === null) {
      setSlot(null)
      dispatch(draftUpdated({ slot_id: null }))
      return
    }
    onSlotChange(next)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canBook || draft.scan_type_id === null || draft.slot_id === null) {
      return
    }
    setSubmitting(true)
    setFailure(null)
    const answers: Record<string, string> = {}
    for (const [key, value] of Object.entries(draft.checklist)) {
      if (typeof value === 'string' && value.trim() !== '') {
        answers[key] = value.trim()
      }
    }
    try {
      const result = await bookingsApi.create({
        scan_type_id: draft.scan_type_id,
        slot_id: draft.slot_id,
        consent: draft.consent,
        patient_notes: draft.notes.trim() === '' ? undefined : draft.notes.trim(),
        answers,
      })
      dispatch(draftReset())
      navigate(`/portal/patient/appointments/${result.appointment.id}`, { state: { confirmed: true, emailSent: result.email_sent ?? false } })
    } catch (cause) {
      const described = describeBookingError(cause)
      setFailure(described)
      setChecklistServerErrors(described.checklist)
      if (described.slotFull) {
        dispatch(draftUpdated({ slot_id: null }))
        setSlot(null)
        setRefreshKey((key) => key + 1)
      } else if (Object.keys(described.checklist).length > 0) {
        goTo(3)
      } else if (described.fields.slot_id !== undefined) {
        goTo(2)
      } else if (described.fields.scan_type_id !== undefined) {
        goTo(1)
      }
      setSubmitting(false)
    }
  }

  if (branches.status === 'loading' || scanTypes.status === 'loading' || (branches.status === 'idle' && scanTypes.status === 'idle')) {
    return <PageLoader label="Loading branches and scans…" />
  }

  const loadFailed = branches.status === 'failed' || scanTypes.status === 'failed'

  return (
    <section aria-labelledby="booking-title" className="wizard">
      <h1 id="booking-title">Book an appointment</h1>
      <p className="wizard__lead">Five short steps. Your answers are used only to prepare for your scan.</p>
      <ol className="stepper" aria-label="Booking progress">
        {STEP_TITLES.map((title, index) => (
          <li
            key={title}
            className={`stepper__item${index === step ? ' stepper__item--current' : ''}${index < step ? ' stepper__item--done' : ''}`}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="stepper__number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="stepper__label">{title}</span>
          </li>
        ))}
      </ol>

      {loadFailed ? (
        <FormAlert>
          {branches.error ?? scanTypes.error}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              branches.reload()
              scanTypes.reload()
            }}
          >
            Try again
          </button>
        </FormAlert>
      ) : null}

      <form onSubmit={(event) => void submit(event)} noValidate className="card wizard__panel">
        <h2 ref={headingRef} tabIndex={-1} className="wizard__heading">
          Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
        </h2>

        {failure !== null && !failure.slotFull ? <FormAlert>{failure.message}</FormAlert> : null}
        {failure !== null && failure.slotFull ? (
          <>
            <FormAlert>{failure.message}</FormAlert>
            {failure.suggestion !== null && draft.branch_id !== null ? (
              <SuggestionBanner
                suggestion={failure.suggestion}
                currentBranchId={draft.branch_id}
                title="This time was just taken"
                onAccept={applySuggestion}
              />
            ) : null}
            <button type="button" className="btn btn--outline btn--sm" onClick={() => goTo(2)}>
              Pick another time
            </button>
          </>
        ) : null}

        {step === 0 ? (
          <RadioGroup
            legend="Branch"
            name="branch_id"
            value={draft.branch_id ?? ''}
            onChange={(event) => {
              dispatch(branchSelected(event.target.value))
              setSlot(null)
            }}
            options={branchList.map((candidate) => ({
              value: candidate.id,
              label: candidate.name,
              description: [candidate.address_line, candidate.area, candidate.city].filter(Boolean).join(', '),
            }))}
          />
        ) : null}

        {step === 1 && modality !== null ? (
          <p className="wizard__filter" role="status">
            Showing {MODALITY_OPTIONS.find((option) => option.value === modality)?.label ?? modality} only.{' '}
            <button type="button" className="link-button" onClick={() => setModality(null)}>
              Show all scans
            </button>
          </p>
        ) : null}

        {step === 1 ? (
          <ScanSearch
            scans={modalityScans}
            query={query}
            selected={draft.scan_type_id}
            onQueryChange={setQuery}
            onSelect={(id) => {
              dispatch(scanSelected(id))
              setSlot(null)
            }}
          />
        ) : null}

        {step === 2 && draft.branch_id !== null && draft.scan_type_id !== null ? (
          <SlotPicker
            branchId={draft.branch_id}
            branchName={branch?.name}
            scanTypeId={draft.scan_type_id}
            date={draft.date === '' ? null : draft.date}
            slotId={draft.slot_id}
            refreshKey={refreshKey}
            onDateChange={onDateChange}
            onSlotChange={onSlotPicked}
            onSwitchBranch={applySuggestion}
          />
        ) : null}

        {step === 3 ? (
          <>
            {checklist.loading ? <PageLoader label="Loading your checklist…" /> : null}
            {checklist.error !== null ? <FormAlert>{checklist.error}</FormAlert> : null}
            {checklist.data !== null ? (
              <>
                <div className="prep" data-testid="preparation">
                  <h3>How to prepare for {checklist.data.scan_type.name}</h3>
                  <p>{checklist.data.scan_type.preparation_tips}</p>
                </div>
                <p className="field__hint">Fields marked * are required.</p>
                <ChecklistStep
                  items={items}
                  answers={draft.checklist}
                  serverErrors={checklistServerErrors}
                  onAnswer={(itemId, answer) => {
                    setChecklistServerErrors((previous) => {
                      const { [itemId]: _removed, ...rest } = previous
                      return rest
                    })
                    dispatch(checklistAnswered({ itemId, answer }))
                  }}
                />
              </>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <dl className="details review">
              <dt>Branch</dt>
              <dd>{branch?.name ?? ''}</dd>
              <dt>Scan</dt>
              <dd>{scan?.name ?? checklist.data?.scan_type.name ?? ''}</dd>
              <dt>Date</dt>
              <dd>{draft.date ? formatDate(draft.date) : ''}</dd>
              <dt>Time</dt>
              <dd>{slot !== null ? formatSlotRange(slot) : 'Choose a time'}</dd>
            </dl>
            {items.some((item) => typeof draft.checklist[item.id] === 'string' && draft.checklist[item.id] !== '') ? (
              <>
                <h3>Your answers</h3>
                <ul className="review__answers">
                  {items.map((item) => {
                    const answer = draft.checklist[item.id]
                    return typeof answer === 'string' && answer !== '' ? (
                      <li key={item.id}>
                        <span>{item.question}</span> <strong>{answer}</strong>
                      </li>
                    ) : null
                  })}
                </ul>
              </>
            ) : null}
            {checklist.data !== null ? (
              <div className="prep">
                <h3>Preparation</h3>
                <p>{checklist.data.scan_type.preparation_tips}</p>
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="booking-notes" className="field__label">
                Anything else the centre should know (optional)
              </label>
              <textarea
                id="booking-notes"
                className="field__input"
                rows={3}
                maxLength={NOTES_MAX}
                value={draft.notes}
                aria-invalid={notesError !== null}
                aria-describedby={notesError !== null ? 'booking-notes-error' : undefined}
                onChange={(event) => dispatch(draftUpdated({ notes: event.target.value }))}
              />
              {notesError !== null || failure?.fields.patient_notes !== undefined ? (
                <p id="booking-notes-error" className="field__error" role="alert">
                  {notesError ?? failure?.fields.patient_notes}
                </p>
              ) : null}
            </div>
            <CheckboxField
              name="consent"
              checked={draft.consent}
              onChange={(event) => dispatch(draftUpdated({ consent: event.target.checked }))}
              error={failure?.fields.consent}
              required
            >
              I agree that Meghnad Diagnostic Centre may collect and use my personal and health information to arrange and carry out this scan, as
              described in the <Link to="/privacy">Privacy Policy</Link>. I can withdraw this consent by contacting the centre.
            </CheckboxField>
            {failure?.fields.slot_id !== undefined && !failure.slotFull ? <FormAlert>{failure.fields.slot_id}</FormAlert> : null}
          </>
        ) : null}

        <div className="wizard__nav">
          <button type="button" className="btn btn--outline" onClick={() => goTo(step - 1)} disabled={step === 0 || submitting}>
            Back
          </button>
          {step < LAST_STEP ? (
            <button type="button" className="btn btn--primary" onClick={() => goTo(step + 1)} disabled={!stepValid[step]}>
              Next
            </button>
          ) : (
            <SubmitButton disabled={!canBook} loading={submitting} loadingText="Booking…">
              Book appointment
            </SubmitButton>
          )}
        </div>
      </form>
    </section>
  )
}
