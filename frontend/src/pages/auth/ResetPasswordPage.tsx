import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'
import { FormAlert } from '../../components/form/FormAlert'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextField } from '../../components/form/TextField'
import { useForm } from '../../hooks/useForm'
import { compose, fieldRules, rules, TOKEN_PATTERN } from '../../lib/validation'

const validators = {
  password: fieldRules.newPassword,
  password_confirmation: compose(rules.required(), rules.matches('password')),
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const form = useForm({ initialValues: { password: '', password_confirmation: '' }, validators })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!TOKEN_PATTERN.test(token)) {
    return (
      <section className="container auth-card">
        <h1>Reset link not valid</h1>
        <FormAlert>This reset link is invalid or incomplete.</FormAlert>
        <Link to="/forgot-password">Request a new link</Link>
      </section>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      return
    }
    setStatus('submitting')
    setError(null)
    try {
      await authApi.resetPassword({
        token,
        password: String(form.values.password),
        password_confirmation: String(form.values.password_confirmation),
      })
      setStatus('done')
    } catch (cause) {
      setStatus('idle')
      if (cause instanceof ApiError) {
        setError(cause.fields.token ?? cause.message)
        form.setServerErrors(cause.fields)
      } else {
        setError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <section className="container auth-card" aria-labelledby="reset-title">
      <h1 id="reset-title">Choose a new password</h1>
      {status === 'done' ? (
        <>
          <FormAlert tone="success">Your password has been reset. You can now sign in.</FormAlert>
          <Link to="/login" className="btn btn--primary">
            Sign in
          </Link>
        </>
      ) : (
        <>
          {error !== null ? <FormAlert>{error}</FormAlert> : null}
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="At least 10 characters with upper and lower case letters, a number and a symbol"
              required
              {...form.field('password')}
            />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" required {...form.field('password_confirmation')} />
            <SubmitButton disabled={!form.isValid} loading={status === 'submitting'} loadingText="Saving…">
              Reset password
            </SubmitButton>
          </form>
        </>
      )}
    </section>
  )
}
