import { DashboardStub } from './DashboardStub'

export default function AdminDashboard() {
  return <DashboardStub area="admin" title="Admin dashboard" upcoming={['Users, branches and scan types', 'Slots and capacity', 'Site settings, FAQs and review moderation', 'Audit log']} />
}
