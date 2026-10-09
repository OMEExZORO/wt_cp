import { useRef, useState, type ChangeEvent } from 'react'
import { adminApi } from '../../api/admin'
import { ApiError } from '../../api/client'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { SettingsForm } from '../../components/admin/SettingsForm'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { useApiQuery } from '../../hooks/useApi'
import type { AdminSetting } from '../../types/admin'

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export function photoProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return 'Choose a JPEG, PNG or WebP image.'
  }
  return file.size > MAX_BYTES ? 'The image must be 2 MB or smaller.' : null
}

export default function DoctorProfilePage() {
  const { data, error, loading, reload } = useApiQuery(() => adminApi.settings(), [])
  const [saved, setSaved] = useState<AdminSetting[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const settings = saved ?? data?.settings ?? null
  const photo = settings?.find((setting) => setting.key === 'doctor.photo_url')

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file === undefined) {
      return
    }
    const problem = photoProblem(file)
    if (problem !== null) {
      setPhotoError(problem)
      event.target.value = ''
      return
    }
    setBusy(true)
    setPhotoError(null)
    try {
      await adminApi.uploadDoctorPhoto(file)
      setNotice('The doctor photo was updated.')
      setSaved(null)
      await reload()
    } catch (cause) {
      setPhotoError(cause instanceof ApiError ? (cause.fields.photo ?? cause.message) : 'The upload failed. Please try again.')
    } finally {
      setBusy(false)
      if (fileRef.current !== null) {
        fileRef.current.value = ''
      }
    }
  }

  return (
    <section aria-labelledby="doctor-heading">
      <h1 id="doctor-heading">Doctor profile</h1>
      <p className="muted">This content appears on the About page and the home page. Only add details the doctor has approved.</p>
      {notice !== null ? <FormAlert tone="success">{notice}</FormAlert> : null}
      {error !== null ? <FormAlert>{error.message}</FormAlert> : null}
      {loading && settings === null ? <PageLoader /> : null}
      {settings !== null ? (
        <>
          <div className="card">
            <h2>Photo</h2>
            {photo?.value ? <img className="doctor-photo-preview" src={photo.value} alt="Current doctor portrait" width={160} height={187} /> : <p className="muted">No photo uploaded yet.</p>}
            {photoError !== null ? <FormAlert>{photoError}</FormAlert> : null}
            <div className="photo-actions">
              <label className="btn btn--outline" aria-busy={busy}>
                {busy ? 'Uploading…' : photo?.value ? 'Replace photo' : 'Upload photo'}
                <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} onChange={(event) => void upload(event)} disabled={busy} className="visually-hidden" aria-label="Doctor photo file" />
              </label>
              {photo?.value ? (
                <button type="button" className="btn btn--danger-outline" onClick={() => setRemoving(true)}>
                  Remove photo
                </button>
              ) : null}
            </div>
            <p className="field__hint">JPEG, PNG or WebP, at most 2 MB, between 200 and 6000 pixels on each side.</p>
          </div>
          <div className="card">
            <h2>Profile text</h2>
            <SettingsForm
              settings={settings}
              groups={['doctor']}
              submitLabel="Save profile"
              onSaved={(next) => {
                setSaved(next)
                setNotice('The doctor profile was saved.')
              }}
            />
          </div>
        </>
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Remove photo"
          confirmLabel="Remove"
          tone="danger"
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            await adminApi.removeDoctorPhoto()
            setRemoving(false)
            setNotice('The doctor photo was removed.')
            setSaved(null)
            await reload()
          }}
        >
          <p>Remove the doctor photo from the website?</p>
        </ConfirmDialog>
      ) : null}
    </section>
  )
}
