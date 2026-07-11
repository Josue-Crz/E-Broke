import { ArrowRight, GraduationCap, LogIn } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { isAllowedEmail, emailErrorMessage } from '../lib/demo'
import { api, friendlyError } from '../lib/api'
import type { User } from '../types'

interface AuthLocationState {
  from?: string
  email?: string
}

function safeDestination(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const { showToast } = useToast()
  const routeState = (location.state ?? {}) as AuthLocationState
  const destination = safeDestination(routeState.from)
  const [email, setEmail] = useState(routeState.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!isAllowedEmail(normalizedEmail)) {
      setError(emailErrorMessage)
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await api<{ user: User }>('/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password },
      })
      setUser(result.user)
      if (!result.user.verified) {
        navigate('/verify-email', {
          replace: true,
          state: { email: result.user.email, from: destination },
        })
        return
      }
      showToast(`Welcome back, ${result.user.name.split(' ')[0]}!`, 'success')
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(friendlyError(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page page-shell">
      <section className="auth-card" aria-labelledby="login-heading">
        <div className="auth-card__icon" aria-hidden="true"><LogIn /></div>
        <div className="auth-card__heading">
          <span className="eyebrow">Welcome back, Gator</span>
          <h1 id="login-heading">Log in to e-Broke</h1>
          <p>Save finds, claim items, and connect with other SFSU students.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}

          <label className="field" htmlFor="login-email">
            <span>SFSU email</span>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@sfsu.edu"
              autoComplete="email"
              inputMode="email"
              required
              autoFocus
            />
          </label>

          <label className="field" htmlFor="login-password">
            <span>Password</span>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={200}
              required
            />
          </label>

          <button className="button button--primary button--full" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
            {!submitting && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>

        <p className="auth-card__switch">
          New to e-Broke?{' '}
          <Link to="/register" state={{ from: destination, email: email.trim() || undefined }}>
            Create an account
          </Link>
        </p>

        <div className="auth-card__note">
          <GraduationCap size={19} aria-hidden="true" />
          <span>Only @sfsu.edu accounts can join our campus community.</span>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
