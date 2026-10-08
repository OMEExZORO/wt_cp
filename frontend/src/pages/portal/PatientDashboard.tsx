import { DashboardStub } from './DashboardStub'

export default function PatientDashboard() {
  return <DashboardStub area="patient" title="Patient dashboard" upcoming={['Book and manage appointments', 'Pre-scan checklists', 'Download your reports']} />
}
