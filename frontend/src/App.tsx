import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { ErrorBoundary } from './components/ErrorBoundary'
import { GuestRoute } from './components/GuestRoute'
import { PublicLayout } from './components/layout/PublicLayout'
import { PageLoader } from './components/PageLoader'
import { ProtectedRoute } from './components/ProtectedRoute'
import { fetchMe, selectAuthStatus } from './features/auth/authSlice'

const HomePage = lazy(() => import('./pages/HomePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'))
const PortalLayout = lazy(() => import('./components/layout/PortalLayout').then((m) => ({ default: m.PortalLayout })))
const PortalHome = lazy(() => import('./pages/portal/PortalHome'))
const PatientDashboard = lazy(() => import('./pages/portal/PatientDashboard'))
const DoctorDashboard = lazy(() => import('./pages/portal/DoctorDashboard'))
const ReceptionDashboard = lazy(() => import('./pages/portal/ReceptionDashboard'))
const AdminDashboard = lazy(() => import('./pages/portal/AdminDashboard'))
const ReferrerDashboard = lazy(() => import('./pages/portal/ReferrerDashboard'))
const AccountPage = lazy(() => import('./pages/portal/AccountPage'))

export default function App() {
  const dispatch = useAppDispatch()
  const status = useAppSelector(selectAuthStatus)

  useEffect(() => {
    if (status === 'idle') {
      void dispatch(fetchMe())
    }
  }, [status, dispatch])

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route element={<GuestRoute />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
            </Route>
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="403" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="portal" element={<ProtectedRoute />}>
            <Route element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="account" element={<AccountPage />} />
              <Route element={<ProtectedRoute roles={['patient']} />}>
                <Route path="patient" element={<PatientDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['doctor', 'admin']} />}>
                <Route path="doctor" element={<DoctorDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['receptionist', 'admin']} />}>
                <Route path="reception" element={<ReceptionDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="admin" element={<AdminDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['referrer']} />}>
                <Route path="referrer" element={<ReferrerDashboard />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
