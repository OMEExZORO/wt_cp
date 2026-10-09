import { useState } from 'react'
import { adminApi } from '../../api/admin'
import { SettingsForm } from '../../components/admin/SettingsForm'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { useApiQuery } from '../../hooks/useApi'
import type { AdminSetting } from '../../types/admin'

const SECTIONS: { id: string; title: string; groups: string[]; description: string }[] = [
  { id: 'contact', title: 'Contact details and hours', groups: ['contact'], description: 'Shown on the Contact page, the footer and the mobile Call and WhatsApp buttons.' },
  { id: 'links', title: 'Links', groups: ['links'], description: 'Google Maps and Google reviews links. Only https:// links are accepted.' },
  { id: 'fees', title: 'Fees information', groups: ['fees'], description: 'A note shown to patients about fees. Leave empty until the doctor confirms it.' },
  { id: 'alerts', title: 'Critical alert escalation', groups: ['alerts'], description: 'Minutes to wait for an acknowledgement before a critical finding is escalated.' },
]

export default function SettingsPage() {
  const { data, error, loading, reload } = useApiQuery(() => adminApi.settings(), [])
  const [saved, setSaved] = useState<AdminSetting[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const settings = saved ?? data?.settings ?? null

  return (
    <section aria-labelledby="settings-heading">
      <h1 id="settings-heading">Site settings</h1>
      <p className="muted">Values left empty are treated as not set yet and are hidden from visitors in production.</p>
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      {error !== null ? (
        <div className="alert alert--error" role="alert">
          <p>{error.message}</p>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}
      {loading && settings === null ? <PageLoader /> : null}
      {settings !== null
        ? SECTIONS.map((section) => (
            <div className="card" key={section.id}>
              <h2>{section.title}</h2>
              <p className="muted">{section.description}</p>
              <SettingsForm
                settings={settings}
                groups={section.groups}
                submitLabel={`Save ${section.title.toLowerCase()}`}
                onSaved={(next) => {
                  setSaved(next)
                  setNotice(`${section.title} saved.`)
                }}
              />
            </div>
          ))
        : null}
    </section>
  )
}
