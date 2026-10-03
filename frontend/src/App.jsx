import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Home from './pages/public/Home.jsx';
import About from './pages/public/About.jsx';
import Services from './pages/public/Services.jsx';
import Branches from './pages/public/Branches.jsx';
import Contact from './pages/public/Contact.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import NotFound from './pages/public/NotFound.jsx';
import DashboardLayout from './pages/dashboard/DashboardLayout.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import BookAppointment from './pages/dashboard/BookAppointment.jsx';
import Appointments from './pages/dashboard/Appointments.jsx';
import Reports from './pages/dashboard/Reports.jsx';
import Profile from './pages/dashboard/Profile.jsx';
import AdminBranches from './pages/admin/Branches.jsx';
import AdminScanTypes from './pages/admin/ScanTypes.jsx';
import AdminSlots from './pages/admin/Slots.jsx';
import AdminStaff from './pages/admin/Staff.jsx';
import AdminMessages from './pages/admin/Messages.jsx';
import SafetyChecklists from './pages/clinical/SafetyChecklists.jsx';
import CriticalAlerts from './pages/clinical/CriticalAlerts.jsx';
import ReadingQueue from './pages/clinical/ReadingQueue.jsx';

const DOCTOR = ['doctor'];
const STAFF = ['doctor', 'receptionist'];

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="services" element={<Services />} />
          <Route path="branches" element={<Branches />} />
          <Route path="contact" element={<Contact />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route
          path="dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="book" element={<RequireAuth roles={['patient', 'receptionist', 'doctor']}><BookAppointment /></RequireAuth>} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="reports" element={<RequireAuth roles={['patient', 'doctor', 'referring_doctor']}><Reports /></RequireAuth>} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin/branches" element={<RequireAuth roles={DOCTOR}><AdminBranches /></RequireAuth>} />
          <Route path="admin/scan-types" element={<RequireAuth roles={DOCTOR}><AdminScanTypes /></RequireAuth>} />
          <Route path="admin/slots" element={<RequireAuth roles={DOCTOR}><AdminSlots /></RequireAuth>} />
          <Route path="admin/staff" element={<RequireAuth roles={DOCTOR}><AdminStaff /></RequireAuth>} />
          <Route path="admin/messages" element={<RequireAuth roles={STAFF}><AdminMessages /></RequireAuth>} />
          <Route path="clinical/checklists" element={<RequireAuth roles={STAFF}><SafetyChecklists /></RequireAuth>} />
          <Route path="clinical/alerts" element={<RequireAuth roles={DOCTOR}><CriticalAlerts /></RequireAuth>} />
          <Route path="clinical/reading-queue" element={<RequireAuth roles={DOCTOR}><ReadingQueue /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
