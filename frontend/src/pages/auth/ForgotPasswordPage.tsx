import { useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { FormAlert } from '../../components/form/FormAlert'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextField } from '../../components/form/TextField'
import { useApi } from '../../hooks/useApi'
import { useForm } from '../../hooks/useForm'
import { fieldRules } from '../../lib/validation'

const validators = { email: fieldRules.email }

export default function ForgotPasswordPage() {
  const form = useForm({ initialValues: { email: '' }, validators })
  const request = useApi(authApi.forgotPassword)
  const { setServerErrors } = form

  useEffect(() => {
    if (request.error !== null) {
      setServerErrors(request.error.fields)
    }
  }, [request.error, setServerErrors])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      return
    }
    await request.run({ email: String(form.trimmedValues().email).toLowerCase() })
  }

  return (
    <section className="container auth-card" aria-labelledby="forgot-title">
      <h1 id="forgot-title">Forgot your password?</h1>
      {request.data !== null ? (
        <FormAlert tone="success">{request.data.message}</FormAlert>
      ) : (
        <>
          <p>Enter the email address you registered with and we will send you a link to choose a new password.</p>
          {request.error !== null ? <FormAlert>{request.error.message}</FormAlert> : null}
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
            <TextField label="Email address" type="email" autoComplete="email" required {...form.field('email')} />
            <SubmitButton disabled={!form.isValid} loading={request.loading} loadingText="Sending…">
              Send reset link
            </SubmitButton>
          </form>
        </>
      )}
      <p className="auth-card__links">
        <Link to="/login">Back to sign in</Link>
      </p>
    </section>
  )
}
