import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { FormAlert } from '../../components/form/FormAlert'
import { PageLoader } from '../../components/PageLoader'
import { selectUser, userUpdated } from '../../features/auth/authSlice'
import { homeFor } from '../../lib/roles'
import { TOKEN_PATTERN } from '../../lib/validation'

type Status = 'verifying' | 'verified' | 'failed'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)
  const [status, setStatus] = useState<Status>(TOKEN_PATTERN.test(token) ? 'verifying' : 'failed')
  const [message, setMessage] = useState('This verification link is invalid or incomplete.')
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !TOKEN_PATTERN.test(token)) {
      return
    }
    started.current = true
    authApi
      .verifyEmail(token)
      .then((result) => {
        if (result.user !== null) {
          dispatch(userUpdated(result.user))
        }
        setMessage(result.message)
        setStatus('verified')
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof ApiError ? (cause.fields.token ?? cause.message) : 'Something went wrong. Please try again.')
        setStatus('failed')
      })
  }, [token, dispatch])

  return (
    <section className="container auth-card" aria-labelledby="verify-title">
      <h1 id="verify-title">Email verification</h1>
      {status === 'verifying' ? <PageLoader label="Verifying your email…" /> : null}
      {status === 'verified' ? <FormAlert tone="success">{message}</FormAlert> : null}
      {status === 'failed' ? <FormAlert>{message}</FormAlert> : null}
      {status !== 'verifying' ? (
        <p>{user !== null ? <Link to={homeFor(user.role)}>Go to your dashboard</Link> : <Link to="/login">Sign in</Link>}</p>
      ) : null}
    </section>
  )
}
