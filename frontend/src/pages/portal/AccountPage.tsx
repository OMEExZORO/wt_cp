import { useState, type FormEvent } from 'react'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { FormAlert } from '../../components/form/FormAlert'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextField } from '../../components/form/TextField'
import { selectUser, sessionExpired } from '../../features/auth/authSlice'
import { useForm } from '../../hooks/useForm'
import { compose, fieldRules, rules } from '../../lib/validation'

const validators = {
  current_password: compose(rules.required()),
  password: fieldRules.newPassword,
  password_confirmation: compose(rules.required(), rules.matches('password')),
}

const initialValues = { current_password: '', password: '', password_confirmation: '' }

export default function AccountPage() {
  const user = useAppSelector(selectUser)
  const dispatch = useAppDispatch()
  const form = useForm({ initialValues, validators })
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      return
    }
    setSubmitting(true)
    setNotice(null)
    try {
      const result = await authApi.changePassword({
        current_password: String(form.values.current_password),
        password: String(form.values.password),
        password_confirmation: String(form.values.password_confirmation),
      })
      form.reset(initialValues)
      setNotice({ tone: 'success', text: result.message })
    } catch (cause) {
      if (cause instanceof ApiError) {
        form.setServerErrors(cause.fields)
        setNotice({ tone: 'error', text: cause.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const signOutEverywhere = async () => {
    try {
      await authApi.logoutEverywhere()
    } finally {
      dispatch(sessionExpired())
    }
  }

  return (
    <section aria-labelledby="account-title">
      <h1 id="account-title">My account</h1>
      {user !== null ? (
        <dl className="details">
          <dt>Name</dt>
          <dd>{user.full_name}</dd>
          <dt>Email</dt>
          <dd>
            {user.email} {user.email_verified ? '(verified)' : '(not verified)'}
          </dd>
          <dt>Mobile</dt>
          <dd>{user.phone ?? 'Not provided'}</dd>
        </dl>
      ) : null}
      <div className="card">
        <h2>Change password</h2>
        {notice !== null ? <FormAlert tone={notice.tone}>{notice.text}</FormAlert> : null}
        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <TextField label="Current password" type="password" autoComplete="current-password" required {...form.field('current_password')} />
          <TextField label="New password" type="password" autoComplete="new-password" required {...form.field('password')} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" required {...form.field('password_confirmation')} />
          <SubmitButton disabled={!form.isValid} loading={submitting} loadingText="Saving…">
            Change password
          </SubmitButton>
        </form>
      </div>
      <div className="card">
        <h2>Devices</h2>
        <p>Sign out of this browser and remove "keep me signed in" from every device.</p>
        <button type="button" className="btn btn--ghost" onClick={() => void signOutEverywhere()}>
          Sign out everywhere
        </button>
      </div>
    </section>
  )
}
