import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AlertBanner {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  requires_acknowledgement: boolean
  created_at: string
}

export interface AlertsState {
  items: AlertBanner[]
  dismissed: string[]
}

const initialState: AlertsState = {
  items: [],
  dismissed: [],
}

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    alertsReceived(state, action: PayloadAction<AlertBanner[]>) {
      state.items = action.payload
    },
    alertDismissed(state, action: PayloadAction<string>) {
      if (!state.dismissed.includes(action.payload)) {
        state.dismissed.push(action.payload)
      }
    },
    alertsCleared() {
      return initialState
    },
  },
})

export const { alertsReceived, alertDismissed, alertsCleared } = alertsSlice.actions
export default alertsSlice.reducer
