import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { setUnauthorizedHandler } from './api/client'
import App from './App'
import { store } from './app/store'
import { ThemeProvider } from './context/ThemeContext'
import { sessionExpired } from './features/auth/authSlice'
import './styles/tokens.css'
import './index.css'
import './styles/site.css'
import './styles/booking.css'

setUnauthorizedHandler(() => {
  store.dispatch(sessionExpired())
})

const rootElement = document.getElementById('root')

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Provider store={store}>
        <ThemeProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </Provider>
    </StrictMode>,
  )
}
