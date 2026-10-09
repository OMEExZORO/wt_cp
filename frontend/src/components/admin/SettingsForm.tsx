import { useMemo } from 'react'
import { adminApi } from '../../api/admin'
import type { AdminSetting } from '../../types/admin'
import { EntityForm, type FieldDef, type FieldKind, type FormValues } from './EntityForm'

export interface SettingsFormProps {
  settings: AdminSetting[]
  groups: string[]
  onSaved: (settings: AdminSetting[]) => void
  submitLabel?: string
  excludeKeys?: string[]
}

export function fieldKindFor(setting: AdminSetting): FieldKind {
  switch (setting.type) {
    case 'phone':
      return 'tel'
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'text':
      return 'textarea'
    default:
      return setting.key === 'alerts.escalation_minutes' ? 'number' : 'text'
  }
}

export function settingFields(settings: AdminSetting[]): FieldDef[] {
  return settings.map((setting) => {
    const kind = fieldKindFor(setting)
    const hint = setting.is_placeholder ? 'Not set yet. The website hides this until a real value is saved.' : undefined
    return {
      name: setting.key,
      label: setting.label,
      kind,
      required: setting.is_required,
      hint,
      maxLength: kind === 'textarea' ? 2000 : kind === 'url' ? 500 : 255,
      min: kind === 'number' ? 1 : undefined,
      max: kind === 'number' ? 1440 : undefined,
      rows: kind === 'textarea' ? 5 : undefined,
    }
  })
}

export function SettingsForm({ settings, groups, onSaved, submitLabel = 'Save settings', excludeKeys = [] }: SettingsFormProps) {
  const editable = useMemo(
    () => settings.filter((setting) => setting.is_editable && groups.includes(setting.group) && !excludeKeys.includes(setting.key)),
    [settings, groups, excludeKeys],
  )
  const fields = useMemo(() => settingFields(editable), [editable])
  const initialValues = useMemo(() => Object.fromEntries(editable.map((setting) => [setting.key, setting.value ?? ''])), [editable])

  if (editable.length === 0) {
    return <p className="muted">There are no editable settings in this section.</p>
  }

  return (
    <EntityForm
      key={editable.map((setting) => `${setting.key}:${setting.updated_at ?? ''}`).join('|')}
      fields={fields}
      initialValues={initialValues}
      submitLabel={submitLabel}
      onSubmit={async (values: FormValues) => {
        const changes: Record<string, string | null> = {}
        for (const setting of editable) {
          const next = typeof values[setting.key] === 'string' ? (values[setting.key] as string).trim() : ''
          const current = setting.value ?? ''
          if (next !== current) {
            changes[setting.key] = next === '' ? null : next
          }
        }
        if (Object.keys(changes).length === 0) {
          return
        }
        const response = await adminApi.updateSettings(changes)
        onSaved(response.settings)
      }}
    />
  )
}
