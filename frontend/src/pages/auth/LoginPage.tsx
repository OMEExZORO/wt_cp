import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { CheckboxField } from '../../components/form/CheckboxField'
import { FormAlert } from '../../components/form/FormAlert'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextField } from '../../components/form/TextField'
import { login, selectAuth } from '../../features/auth/authSlice'
import { useForm } from '../../hooks/useForm'
import { fieldRules } from '../../lib/validation'

const validators = {
  email: fieldRules.email,
  password: fieldRules.loginPassword,
}

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const { sessionExpired } = useAppSelector(selectAuth)
  const form = useForm({ initialValues: { email: '', password: '', remember: false as boolean }, validators })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      return
    }
    setSubmitting(true)
    setFormError(null)
    const values = form.trimmedValues()
    const result = await dispatch(
      login({ email: String(values.email).toLowerCase(), password: String(values.password), remember: values.remember === true }),
    )
    if (login.rejected.match(result)) {
      setFormError(result.payload?.message ?? 'Sign in failed. Please try again.')
      form.setServerErrors(result.payload?.fields ?? {})
      setSubmitting(false)
    }
  }

  return (
    <section className="container auth-card" aria-labelledby="login-title">
      <h1 id="login-title">Sign in</h1>
      <p>Sign in to book scans, download reports and manage your appointments.</p>
      {sessionExpired ? <FormAlert tone="info">Your session ended. Please sign in again.</FormAlert> : null}
      {formError !== null ? <FormAlert>{formError}</FormAlert> : null}
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <TextField ref={emailRef} label="Email address" type="email" autoComplete="email" required {...form.field('email')} />
        <TextField label="Password" type="password" autoComplete="current-password" required {...form.field('password')} />
        <CheckboxField {...form.checkbox('remember')}>Keep me signed in on this device</CheckboxField>
        <SubmitButton disabled={!form.isValid} loading={submitting} loadingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <p className="auth-card__links">
        <Link to="/forgot-password">Forgot your password?</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/register">Create an account</Link>
      </p>
    </section>
  )
}
