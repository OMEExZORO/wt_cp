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
const AboutPage = lazy(() => import('./pages/public/AboutPage'))
const ServicesPage = lazy(() => import('./pages/public/ServicesPage'))
const ScanDetailPage = lazy(() => import('./pages/public/ScanDetailPage'))
const BranchesPage = lazy(() => import('./pages/public/BranchesPage'))
const ReviewsPage = lazy(() => import('./pages/public/ReviewsPage'))
const FaqPage = lazy(() => import('./pages/public/FaqPage'))
const ContactPage = lazy(() => import('./pages/public/ContactPage'))
const BookPage = lazy(() => import('./pages/public/BookPage'))
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/public/TermsPage'))
const BookingPage = lazy(() => import('./pages/portal/BookingPage'))
const AppointmentPage = lazy(() => import('./pages/portal/AppointmentPage'))
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
const MyReportsPage = lazy(() => import('./pages/portal/reports/MyReportsPage'))
const StaffReportsPage = lazy(() => import('./pages/portal/reports/StaffReportsPage'))
const UploadReportPage = lazy(() => import('./pages/portal/reports/UploadReportPage'))
const StaffReferralsPage = lazy(() => import('./pages/portal/reports/StaffReferralsPage'))

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
            <Route path="about" element={<AboutPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="services/:slug" element={<ScanDetailPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="book" element={<BookPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
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
                <Route path="patient/book" element={<BookingPage />} />
                <Route path="patient/appointments/:id" element={<AppointmentPage />} />
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
              <Route element={<ProtectedRoute roles={['patient']} />}>
                <Route path="patient/reports" element={<MyReportsPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['doctor', 'admin']} />}>
                <Route path="doctor/reports" element={<StaffReportsPage />} />
                <Route path="doctor/reports/new" element={<UploadReportPage />} />
                <Route path="doctor/referrals" element={<StaffReferralsPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['receptionist', 'admin']} />}>
                <Route path="reception/reports" element={<StaffReportsPage />} />
                <Route path="reception/reports/new" element={<UploadReportPage />} />
                <Route path="reception/referrals" element={<StaffReferralsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
