import { DashboardStub } from './DashboardStub'

export default function DoctorDashboard() {
  return <DashboardStub area="doctor" title="Doctor dashboard" upcoming={['Priority reading queue', 'Report upload', 'Critical finding alerts']} />
}
