import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { alertsApi } from '../../api/alerts'
import { ApiError } from '../../api/client'
import type { AlertBanner } from '../../types/alerts'

export type { AlertBanner } from '../../types/alerts'

export interface AlertsState {
  items: AlertBanner[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  acknowledging: string[]
  error: string | null
}

const initialState: AlertsState = {
  items: [],
  status: 'idle',
  acknowledging: [],
  error: null,
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}

export const fetchMyAlerts = createAsyncThunk<AlertBanner[], void, { rejectValue: string }>(
  'alerts/fetchMine',
  async (_, { rejectWithValue }) => {
    try {
      const { alerts } = await alertsApi.mine()
      return alerts
    } catch (error) {
      return rejectWithValue(messageOf(error))
    }
  },
)

export const acknowledgeAlert = createAsyncThunk<string, string, { rejectValue: string }>(
  'alerts/acknowledge',
  async (id, { rejectWithValue }) => {
    try {
      await alertsApi.acknowledge(id)
      return id
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return id
      }
      return rejectWithValue(messageOf(error))
    }
  },
)

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    alertsCleared() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyAlerts.pending, (state) => {
        if (state.status === 'idle') {
          state.status = 'loading'
        }
      })
      .addCase(fetchMyAlerts.fulfilled, (state, action) => {
        state.items = action.payload
        state.status = 'ready'
        state.error = null
      })
      .addCase(fetchMyAlerts.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.payload ?? 'Could not load alerts.'
      })
      .addCase(acknowledgeAlert.pending, (state, action) => {
        state.acknowledging.push(action.meta.arg)
        state.error = null
      })
      .addCase(acknowledgeAlert.fulfilled, (state, action) => {
        state.acknowledging = state.acknowledging.filter((id) => id !== action.payload)
        state.items = state.items.filter((item) => item.id !== action.payload)
      })
      .addCase(acknowledgeAlert.rejected, (state, action) => {
        state.acknowledging = state.acknowledging.filter((id) => id !== action.meta.arg)
        state.error = action.payload ?? 'Could not acknowledge the alert.'
      })
  },
})

export const { alertsCleared } = alertsSlice.actions
export default alertsSlice.reducer
