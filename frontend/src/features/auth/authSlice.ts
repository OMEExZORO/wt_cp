import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'
import { clearSessionHint, hasSessionHint, setSessionHint } from './sessionHint'
import type { LoginRequest, RegisterRequest, User } from '../../types/auth'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'guest'

export interface AuthErrorPayload {
  code: string
  message: string
  fields: Record<string, string>
}

export interface AuthState {
  user: User | null
  status: AuthStatus
  error: AuthErrorPayload | null
  sessionExpired: boolean
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
  sessionExpired: false,
}

function toPayload(error: unknown): AuthErrorPayload {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, fields: error.fields }
  }
  return { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.', fields: {} }
}

export const fetchMe = createAsyncThunk<User | null, void, { rejectValue: AuthErrorPayload }>(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    if (!hasSessionHint()) {
      return null
    }
    try {
      const { user } = await authApi.me()
      setSessionHint()
      return user
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSessionHint()
        return null
      }
      return rejectWithValue(toPayload(error))
    }
  },
)

export const login = createAsyncThunk<User, LoginRequest, { rejectValue: AuthErrorPayload }>(
  'auth/login',
  async (payload, { rejectWithValue }) => {
    try {
      const { user } = await authApi.login(payload)
      setSessionHint()
      return user
    } catch (error) {
      return rejectWithValue(toPayload(error))
    }
  },
)

export const register = createAsyncThunk<User, RegisterRequest, { rejectValue: AuthErrorPayload }>(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    try {
      const { user } = await authApi.register(payload)
      setSessionHint()
      return user
    } catch (error) {
      return rejectWithValue(toPayload(error))
    }
  },
)

export const logout = createAsyncThunk('auth/logout', async () => {
  clearSessionHint()
  try {
    await authApi.logout()
  } catch {
    return
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload
      state.status = 'authenticated'
    },
    sessionExpired(state) {
      clearSessionHint()
      if (state.status === 'authenticated') {
        state.sessionExpired = true
      }
      state.user = null
      state.status = 'guest'
    },
    clearAuthError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = action.payload === null ? 'guest' : 'authenticated'
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.user = null
        state.status = 'guest'
        state.error = action.payload ?? null
      })
      .addCase(login.pending, (state) => {
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.sessionExpired = false
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.payload ?? null
      })
      .addCase(register.pending, (state) => {
        state.error = null
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.error = null
      })
      .addCase(register.rejected, (state, action) => {
        state.error = action.payload ?? null
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.status = 'guest'
        state.error = null
      })
  },
})

export const { userUpdated, sessionExpired, clearAuthError } = authSlice.actions
export default authSlice.reducer

export const selectAuth = (state: { auth: AuthState }) => state.auth
export const selectUser = (state: { auth: AuthState }) => state.auth.user
export const selectAuthStatus = (state: { auth: AuthState }) => state.auth.status
