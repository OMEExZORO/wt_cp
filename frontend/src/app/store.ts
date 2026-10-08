import { combineReducers, configureStore } from '@reduxjs/toolkit'
import alertsReducer from '../features/alerts/alertsSlice'
import authReducer from '../features/auth/authSlice'
import bookingReducer from '../features/booking/bookingSlice'
import publicReducer from '../features/public/publicSlice'

const rootReducer = combineReducers({
  auth: authReducer,
  booking: bookingReducer,
  alerts: alertsReducer,
  public: publicReducer,
})

export type RootState = ReturnType<typeof rootReducer>

export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  })
}

export const store = setupStore()

export type AppStore = ReturnType<typeof setupStore>
export type AppDispatch = AppStore['dispatch']
