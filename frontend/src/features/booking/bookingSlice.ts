import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type ChecklistAnswer = string | boolean

export interface BookingDraft {
  branch_id: string | null
  scan_type_id: string | null
  date: string | null
  slot_id: string | null
  urgency: 'Routine' | 'Priority' | 'Urgent'
  checklist: Record<string, ChecklistAnswer>
  notes: string
  consent: boolean
}

export interface BookingState {
  draft: BookingDraft
  step: number
}

const emptyDraft: BookingDraft = {
  branch_id: null,
  scan_type_id: null,
  date: null,
  slot_id: null,
  urgency: 'Routine',
  checklist: {},
  notes: '',
  consent: false,
}

const initialState: BookingState = {
  draft: emptyDraft,
  step: 0,
}

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    draftUpdated(state, action: PayloadAction<Partial<Omit<BookingDraft, 'checklist'>>>) {
      state.draft = { ...state.draft, ...action.payload }
    },
    branchSelected(state, action: PayloadAction<string>) {
      if (state.draft.branch_id !== action.payload) {
        state.draft.branch_id = action.payload
        state.draft.slot_id = null
      }
    },
    scanSelected(state, action: PayloadAction<string>) {
      if (state.draft.scan_type_id !== action.payload) {
        state.draft.scan_type_id = action.payload
        state.draft.slot_id = null
        state.draft.checklist = {}
      }
    },
    slotChosen(state, action: PayloadAction<{ branchId?: string; date: string; slotId: string | null }>) {
      if (action.payload.branchId !== undefined) {
        state.draft.branch_id = action.payload.branchId
      }
      state.draft.date = action.payload.date
      state.draft.slot_id = action.payload.slotId
    },
    checklistAnswered(state, action: PayloadAction<{ itemId: string; answer: ChecklistAnswer }>) {
      state.draft.checklist[action.payload.itemId] = action.payload.answer
    },
    stepChanged(state, action: PayloadAction<number>) {
      state.step = Math.max(0, action.payload)
    },
    draftReset() {
      return initialState
    },
  },
})

export const { draftUpdated, branchSelected, scanSelected, slotChosen, checklistAnswered, stepChanged, draftReset } = bookingSlice.actions
export default bookingSlice.reducer
