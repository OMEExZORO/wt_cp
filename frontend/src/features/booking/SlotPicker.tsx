import { useEffect, useId, useRef, useState } from 'react'
import { bookingsApi } from '../../api/bookings'
import { ApiError } from '../../api/client'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { formatDate, formatShortDate, formatSlotRange, lastBookableIso, todayIso } from '../../lib/booking'
import type { AvailabilityResponse, DaySummary, Slot, SlotSuggestion } from '../../types/booking'
import { SuggestionBanner } from './SuggestionBanner'

export interface SlotPickerProps {
  branchId: string
  branchName?: string
  scanTypeId: string
  date: string | null
  slotId: string | null
  excludeSlotId?: string
  refreshKey?: number
  onDateChange: (date: string) => void
  onSlotChange: (slot: Slot | null) => void
  onSwitchBranch: (suggestion: SlotSuggestion) => void
}

const STATUS_TEXT: Record<string, string> = {
  full: 'Full',
  blocked: 'Closed',
  past: 'Passed',
  wrong_modality: 'Unavailable',
  branch_inactive: 'Unavailable',
}

export function SlotPicker({
  branchId,
  branchName,
  scanTypeId,
  date,
  slotId,
  excludeSlotId,
  refreshKey = 0,
  onDateChange,
  onSlotChange,
  onSwitchBranch,
}: SlotPickerProps) {
  const [days, setDays] = useState<DaySummary[]>([])
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const legendId = useId()
  const dateId = useId()
  const slotChange = useRef(onSlotChange)
  slotChange.current = onSlotChange
  const slotIdRef = useRef(slotId)
  slotIdRef.current = slotId
  const min = todayIso()
  const max = lastBookableIso()
  const dateInRange = date !== null && date >= min && date <= max

  useEffect(() => {
    const controller = new AbortController()
    bookingsApi
      .days(branchId, scanTypeId, min, 14, controller.signal)
      .then((response) => setDays(response.days))
      .catch(() => setDays([]))
    return () => controller.abort()
  }, [branchId, scanTypeId, min, refreshKey])

  useEffect(() => {
    if (date === null || !dateInRange) {
      setAvailability(null)
      setError(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    bookingsApi
      .availability(branchId, scanTypeId, date, controller.signal)
      .then((response) => {
        setAvailability(response)
        setLoading(false)
        const current = slotIdRef.current
        if (current !== null) {
          const match = response.slots.find((slot) => slot.id === current && slot.is_available)
          slotChange.current(match ?? null)
        }
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return
        }
        setAvailability(null)
        setLoading(false)
        setError(cause instanceof ApiError ? cause.message : 'We could not load the available times.')
      })
    return () => controller.abort()
  }, [branchId, scanTypeId, date, dateInRange, refreshKey])

  const dateError = date !== null && date !== '' && !dateInRange ? 'Choose a date from today up to 90 days ahead.' : undefined
  const slots = availability?.slots ?? []
  const noneLeft = availability !== null && availability.summary.available === 0

  return (
    <div className="slot-picker">
      <div className="slot-picker__days">
        <p className="field__label" id={`${legendId}-days`}>
          Pick a day
        </p>
        <div className="chips" role="group" aria-labelledby={`${legendId}-days`}>
          {days.length === 0 ? <span className="field__hint">No sessions are listed for the next two weeks. Try the date field.</span> : null}
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              className={`chip${date === day.date ? ' chip--active' : ''}`}
              aria-pressed={date === day.date}
              onClick={() => onDateChange(day.date)}
            >
              {formatShortDate(day.date)}
              <span className="chip__sub">{day.remaining > 0 ? `${day.remaining} left` : 'Full'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`field${dateError !== undefined ? ' field--invalid' : ''}`}>
        <label htmlFor={dateId} className="field__label">
          Or choose any date
        </label>
        <input
          id={dateId}
          type="date"
          className="field__input slot-picker__date"
          value={date ?? ''}
          min={min}
          max={max}
          onChange={(event) => onDateChange(event.target.value)}
          aria-invalid={dateError !== undefined}
          aria-describedby={dateError !== undefined ? `${dateId}-error` : undefined}
        />
        {dateError !== undefined ? (
          <p id={`${dateId}-error`} className="field__error" role="alert">
            {dateError}
          </p>
        ) : null}
      </div>

      {error !== null ? <FormAlert>{error}</FormAlert> : null}
      {loading ? <PageLoader label="Checking available times…" /> : null}

      {!loading && availability !== null && date !== null ? (
        <>
          {noneLeft || availability.summary.no_sessions ? (
            <>
              <FormAlert tone="info">
                {availability.summary.no_sessions
                  ? `${branchName ?? availability.branch.name} has no sessions for this scan on ${formatDate(date)}.`
                  : `${branchName ?? availability.branch.name} is fully booked on ${formatDate(date)}.`}
              </FormAlert>
              {availability.suggestion !== null ? (
                <SuggestionBanner
                  suggestion={availability.suggestion}
                  currentBranchId={branchId}
                  title="We found another option"
                  onAccept={onSwitchBranch}
                />
              ) : (
                <p className="field__hint">No other times are open in the next few weeks. Please call the centre.</p>
              )}
            </>
          ) : null}

          {slots.length > 0 ? (
            <fieldset className="slot-fieldset">
              <legend id={legendId}>Times on {formatDate(date)}</legend>
              <p className="visually-hidden" role="status">
                {availability.summary.available} of {availability.summary.total} times available
              </p>
              <div className="slot-grid">
                {slots.map((slot) => {
                  const isCurrent = slot.id === excludeSlotId
                  const disabled = !slot.is_available || isCurrent
                  const checked = slotId === slot.id
                  const label = isCurrent ? 'Current time' : slot.is_available ? `${slot.remaining} left` : (STATUS_TEXT[slot.status] ?? 'Unavailable')
                  return (
                    <label key={slot.id} className={`slot-option${checked ? ' slot-option--active' : ''}${disabled ? ' slot-option--disabled' : ''}`}>
                      <input type="radio" name="slot" value={slot.id} checked={checked} disabled={disabled} onChange={() => onSlotChange(slot)} />
                      <span className="slot-option__time">{formatSlotRange(slot)}</span>
                      <span className="slot-option__capacity">{label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : null}
        </>
      ) : null}
      {date === null ? <p className="field__hint">Choose a day to see the times.</p> : null}
    </div>
  )
}
