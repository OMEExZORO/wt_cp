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
const BookingPlaceholder = lazy(() => import('./pages/portal/BookingPlaceholder'))
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
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminHome = lazy(() => import('./pages/admin/AdminHome'))
const AdminUsersPage = lazy(() => import('./pages/admin/UsersPage'))
const AdminBranchesPage = lazy(() => import('./pages/admin/BranchesPage'))
const AdminCatalogPage = lazy(() => import('./pages/admin/CatalogPage'))
const AdminSlotsPage = lazy(() => import('./pages/admin/SlotsPage'))
const AdminSettingsPage = lazy(() => import('./pages/admin/SettingsPage'))
const AdminFaqsPage = lazy(() => import('./pages/admin/FaqsPage'))
const AdminDoctorProfilePage = lazy(() => import('./pages/admin/DoctorProfilePage'))
const AdminReviewsPage = lazy(() => import('./pages/admin/ReviewsModerationPage'))
const AdminAuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'))
const WriteReviewPage = lazy(() => import('./pages/portal/WriteReviewPage'))
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
                <Route path="patient/book" element={<BookingPlaceholder />} />
                <Route path="patient/reviews" element={<WriteReviewPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['doctor', 'admin']} />}>
                <Route path="doctor" element={<DoctorDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['receptionist', 'admin']} />}>
                <Route path="reception" element={<ReceptionDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminHome />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="branches" element={<AdminBranchesPage />} />
                  <Route path="catalog" element={<AdminCatalogPage />} />
                  <Route path="slots" element={<AdminSlotsPage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                  <Route path="faqs" element={<AdminFaqsPage />} />
                  <Route path="doctor" element={<AdminDoctorProfilePage />} />
                  <Route path="reviews" element={<AdminReviewsPage />} />
                  <Route path="audit-log" element={<AdminAuditLogPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
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
