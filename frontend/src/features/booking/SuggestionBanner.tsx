import { formatDate, formatSlotRange } from '../../lib/booking'
import type { SlotSuggestion } from '../../types/booking'

export interface SuggestionBannerProps {
  suggestion: SlotSuggestion
  currentBranchId: string
  title: string
  onAccept: (suggestion: SlotSuggestion) => void
  disabled?: boolean
}

export function SuggestionBanner({ suggestion, currentBranchId, title, onAccept, disabled = false }: SuggestionBannerProps) {
  const otherBranch = suggestion.branch.id !== currentBranchId
  const when = `${formatDate(suggestion.slot.date)}, ${formatSlotRange(suggestion.slot)}`
  return (
    <div className="alert alert--info suggestion" role="status" data-testid="branch-full-suggestion">
      <p className="suggestion__title">
        <strong>{title}</strong>
      </p>
      <p>
        Earliest time at <strong>{suggestion.branch.name}</strong>: {when} ({suggestion.slot.remaining}{' '}
        {suggestion.slot.remaining === 1 ? 'place' : 'places'} left).
      </p>
      <button type="button" className="btn btn--primary btn--sm" onClick={() => onAccept(suggestion)} disabled={disabled}>
        {otherBranch ? `Switch to ${suggestion.branch.name} and use this time` : 'Use this time'}
      </button>
    </div>
  )
}
