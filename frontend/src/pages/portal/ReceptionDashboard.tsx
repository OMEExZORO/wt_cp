import { DashboardStub } from './DashboardStub'

export default function ReceptionDashboard() {
  return <DashboardStub area="receptionist" title="Reception dashboard" upcoming={['Today\'s appointments and check-in', 'Walk-in patient registration', 'Escalated critical alerts']} />
}
