import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { bookingsApi } from '../../api/bookings'
import { patientsApi, type PatientMatch } from '../../api/patients'
import { CheckboxField } from '../../components/form/CheckboxField'
import { FormAlert } from '../../components/form/FormAlert'
import { SelectField } from '../../components/form/SelectField'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextField } from '../../components/form/TextField'
import { PageLoader } from '../../components/PageLoader'
import { usePublicResource } from '../../hooks/usePublicResource'
import { NOTES_MAX, checklistErrors, describeBookingError, formatDate, formatSlotRange, notesProblem, type BookingFailure } from '../../lib/booking'
import { fieldRules, normalisePhone } from '../../lib/validation'
import { URGENCIES, type Appointment, type ChecklistResponse, type Slot, type SlotSuggestion, type Urgency } from '../../types/booking'
import { ChecklistStep } from './ChecklistStep'
import { SlotPicker } from './SlotPicker'
import { SuggestionBanner } from './SuggestionBanner'

type PatientMode = 'existing' | 'new'

export default function WalkInBooking() {
  const branches = usePublicResource('branches')
  const scanTypes = usePublicResource('scanTypes')
  const [mode, setMode] = useState<PatientMode>('new')
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<PatientMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [patient, setPatient] = useState<PatientMatch | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [branchId, setBranchId] = useState('')
  const [scanId, setScanId] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null)
  const [checklistError, setChecklistError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
  const [serverChecklist, setServerChecklist] = useState<Record<string, string>>({})
  const [urgency, setUrgency] = useState<Urgency>('Routine')
  const [notes, setNotes] = useState('')
  const [consent, setConsent] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<BookingFailure | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [booked, setBooked] = useState<Appointment | null>(null)

  const branchList = branches.data?.branches ?? []
  const scanList = scanTypes.data?.scan_types ?? []
  const branch = branchList.find((candidate) => candidate.id === branchId) ?? null

  useEffect(() => {
    setChecklist(null)
    setChecklistError(null)
    setAnswers({})
    if (scanId === '') {
      return
    }
    let cancelled = false
    bookingsApi
      .checklist(scanId)
      .then((data) => {
        if (!cancelled) {
          setChecklist(data)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setChecklistError(describeBookingError(cause).message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [scanId])

  const items = checklist?.items ?? []
  const clientChecklist = useMemo(() => checklistErrors(items, answers), [items, answers])
  const notesError = notesProblem(notes)
  const nameError = mode === 'new' ? fieldRules.fullName(fullName, {}) : null
  const phoneError = mode === 'new' ? fieldRules.phone(normalisePhone(phone), {}) : null
  const patientReady = mode === 'existing' ? patient !== null : nameError === null && phoneError === null
  const valid =
    patientReady &&
    branchId !== '' &&
    scanId !== '' &&
    slot !== null &&
    checklist !== null &&
    Object.keys(clientChecklist).length === 0 &&
    notesError === null &&
    consent

  const runSearch = async () => {
    const term = search.trim()
    if (term.length < 3) {
      setSearchError('Type at least 3 characters of a name or mobile number.')
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const response = await patientsApi.lookup(term)
      setMatches(response.patients)
      setPatient(null)
    } catch (cause) {
      setMatches(null)
      setSearchError(describeBookingError(cause).fields.q ?? describeBookingError(cause).message)
    } finally {
      setSearching(false)
    }
  }

  const applySuggestion = (suggestion: SlotSuggestion) => {
    setBranchId(suggestion.branch.id)
    setDate(suggestion.slot.date)
    setSlot(suggestion.slot)
    setFailure(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!valid || slot === null) {
      return
    }
    setSubmitting(true)
    setFailure(null)
    const cleanAnswers: Record<string, string> = {}
    for (const [key, value] of Object.entries(answers)) {
      if (typeof value === 'string' && value.trim() !== '') {
        cleanAnswers[key] = value.trim()
      }
    }
    try {
      const result = await bookingsApi.create({
        scan_type_id: scanId,
        slot_id: slot.id,
        consent,
        urgency,
        patient_notes: notes.trim() === '' ? undefined : notes.trim(),
        answers: cleanAnswers,
        ...(mode === 'existing' && patient !== null
          ? { patient_id: patient.id }
          : { patient_full_name: fullName.trim(), patient_phone: normalisePhone(phone) }),
      })
      setBooked(result.appointment)
    } catch (cause) {
      const described = describeBookingError(cause)
      setFailure(described)
      setServerChecklist(described.checklist)
      if (described.slotFull) {
        setSlot(null)
        setRefreshKey((key) => key + 1)
      }
      setSubmitting(false)
    }
  }

  if (branches.status === 'failed' || scanTypes.status === 'failed') {
    return <FormAlert>{branches.error ?? scanTypes.error ?? 'Could not load branches and scans.'}</FormAlert>
  }

  if (branches.status !== 'succeeded' || scanTypes.status !== 'succeeded') {
    return <PageLoader label="Loading branches and scans…" />
  }

  if (booked !== null) {
    return (
      <section aria-labelledby="walkin-title">
        <h1 id="walkin-title">Walk-in booked</h1>
        <p role="status">
          {booked.patient.full_name} is booked for {booked.scan_type.name} on {formatDate(booked.slot.date)}, {formatSlotRange(booked.slot)} at {booked.branch.name}.
          Reference <strong>{booked.reference_code}</strong>.
        </p>
        <p>
          <Link to="/portal/reception" className="btn btn--primary">
            Back to reception dashboard
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="walkin-title" className="wizard">
      <h1 id="walkin-title">New walk-in booking</h1>
      <p className="wizard__lead">Book a scan on behalf of a patient who is at the desk or on the phone.</p>
      <form onSubmit={(event) => void submit(event)} noValidate className="card wizard__panel">
        {failure !== null && !failure.slotFull ? <FormAlert>{failure.message}</FormAlert> : null}
        {failure?.slotFull ? (
          <>
            <FormAlert>{failure.message}</FormAlert>
            {failure.suggestion !== null && branchId !== '' ? (
              <SuggestionBanner suggestion={failure.suggestion} currentBranchId={branchId} title="This time was just taken" onAccept={applySuggestion} />
            ) : null}
          </>
        ) : null}

        <fieldset className="walkin__patient">
          <legend>Patient</legend>
          <div className="choice-row">
            <label className={`choice${mode === 'existing' ? ' choice--active' : ''}`}>
              <input type="radio" name="patient-mode" checked={mode === 'existing'} onChange={() => setMode('existing')} />
              <span>Existing patient</span>
            </label>
            <label className={`choice${mode === 'new' ? ' choice--active' : ''}`}>
              <input type="radio" name="patient-mode" checked={mode === 'new'} onChange={() => setMode('new')} />
              <span>New patient</span>
            </label>
          </div>

          {mode === 'existing' ? (
            <div>
              <TextField
                label="Find by name or mobile number"
                name="patient-search"
                type="search"
                value={search}
                maxLength={60}
                autoComplete="off"
                error={searchError ?? undefined}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void runSearch()} disabled={searching}>
                {searching ? 'Searching…' : 'Search patients'}
              </button>
              {matches !== null ? (
                <p className="results-count" role="status">
                  {matches.length} {matches.length === 1 ? 'patient' : 'patients'} found
                </p>
              ) : null}
              {matches !== null && matches.length > 0 ? (
                <fieldset className="walkin__matches">
                  <legend className="visually-hidden">Matching patients</legend>
                  {matches.map((match) => (
                    <label key={match.id} className={`choice${patient?.id === match.id ? ' choice--active' : ''}`}>
                      <input type="radio" name="patient-match" checked={patient?.id === match.id} onChange={() => setPatient(match)} />
                      <span>
                        {match.full_name}
                        {match.phone !== null ? ` · ${match.phone}` : ''}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {matches !== null && matches.length === 0 ? <p>No patient matches. Switch to New patient to add one.</p> : null}
              {touched && patient === null ? <p className="field__error">Choose a patient from the results.</p> : null}
            </div>
          ) : (
            <>
              <TextField
                label="Patient full name"
                name="patient_full_name"
                value={fullName}
                required
                maxLength={120}
                autoComplete="off"
                error={(touched || fullName !== '') && nameError !== null ? nameError : failure?.fields.patient_full_name}
                onChange={(event) => setFullName(event.target.value)}
              />
              <TextField
                label="Mobile number"
                name="patient_phone"
                type="tel"
                value={phone}
                required
                maxLength={16}
                autoComplete="off"
                error={(touched || phone !== '') && phoneError !== null ? phoneError : failure?.fields.patient_phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </>
          )}
        </fieldset>

        <SelectField
          label="Branch"
          name="walkin-branch"
          required
          value={branchId}
          placeholder="Choose a branch"
          options={branchList.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          onChange={(event) => {
            setBranchId(event.target.value)
            setSlot(null)
          }}
        />
        <SelectField
          label="Scan"
          name="walkin-scan"
          required
          value={scanId}
          placeholder="Choose a scan"
          options={scanList.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          onChange={(event) => {
            setScanId(event.target.value)
            setSlot(null)
            setServerChecklist({})
          }}
        />

        {branchId !== '' && scanId !== '' ? (
          <SlotPicker
            branchId={branchId}
            branchName={branch?.name}
            scanTypeId={scanId}
            date={date}
            slotId={slot?.id ?? null}
            refreshKey={refreshKey}
            onDateChange={(next) => {
              setDate(next)
              setSlot(null)
            }}
            onSlotChange={setSlot}
            onSwitchBranch={applySuggestion}
          />
        ) : null}

        {checklistError !== null ? <FormAlert>{checklistError}</FormAlert> : null}
        {checklist !== null ? (
          <>
            <h2 className="wizard__heading">Safety checklist</h2>
            <p className="field__hint">Fields marked * are required.</p>
            <ChecklistStep
              items={items}
              answers={answers}
              serverErrors={serverChecklist}
              onAnswer={(itemId, answer) => setAnswers((previous) => ({ ...previous, [itemId]: answer }))}
            />
          </>
        ) : null}

        <SelectField
          label="Urgency"
          name="walkin-urgency"
          value={urgency}
          options={URGENCIES.map((value) => ({ value, label: value }))}
          onChange={(event) => setUrgency(event.target.value as Urgency)}
        />

        <div className="field">
          <label htmlFor="walkin-notes" className="field__label">
            Notes (optional)
          </label>
          <textarea
            id="walkin-notes"
            className="field__input"
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            aria-invalid={notesError !== null}
            onChange={(event) => setNotes(event.target.value)}
          />
          {notesError !== null ? (
            <p className="field__error" role="alert">
              {notesError}
            </p>
          ) : null}
        </div>

        <CheckboxField name="consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} error={failure?.fields.consent} required>
          The patient has agreed in person that Meghnad Diagnostic Centre may collect and use their personal and health information to arrange this scan, as
          described in the <Link to="/privacy">Privacy Policy</Link>.
        </CheckboxField>

        <div className="wizard__nav">
          <Link to="/portal/reception" className="btn btn--outline">
            Cancel
          </Link>
          <SubmitButton disabled={!valid} loading={submitting} loadingText="Booking…">
            Book walk-in
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
