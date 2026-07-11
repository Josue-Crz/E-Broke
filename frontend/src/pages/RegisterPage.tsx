import { ArrowRight, GraduationCap, UserPlus } from 'lucide-react'
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

interface RegisterResponse {
  user: User
  devVerificationCode?: string
}

function safeDestination(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const { showToast } = useToast()
  const routeState = (location.state ?? {}) as AuthLocationState
  const destination = safeDestination(routeState.from)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(routeState.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedName) {
      setError('Enter your name.')
      return
    }
    if (!isAllowedEmail(normalizedEmail)) {
      setError(emailErrorMessage)
      return
    }
    if (password.length < 8) {
      setError('Create a password with at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Those passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await api<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: { name: normalizedName, email: normalizedEmail, password },
      })
      setUser(result.user)
      showToast('Account created. One quick verification step to go!', 'success')
      navigate('/verify-email', {
        replace: true,
        state: {
          email: result.user.email,
          devVerificationCode: result.devVerificationCode,
          from: destination,
        },
      })
    } catch (requestError) {
      setError(friendlyError(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page page-shell">
      <section className="auth-card" aria-labelledby="register-heading">
        <div className="auth-card__icon" aria-hidden="true"><UserPlus /></div>
        <div className="auth-card__heading">
          <span className="eyebrow">Join the campus sharing loop</span>
          <h1 id="register-heading">Create your e-Broke account</h1>
          <p>Give useful things a second life and find what you need—always for free.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}

          <label className="field" htmlFor="register-name">
            <span>Name</span>
            <input
              id="register-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={100}
              required
              autoFocus
            />
          </label>

          <label className="field" htmlFor="register-email">
            <span>SFSU email</span>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@sfsu.edu"
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>

          <label className="field" htmlFor="register-password">
            <span>Password</span>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              aria-describedby="password-help"
              required
            />
            <small id="password-help">At least 8 characters</small>
          </label>

          <label className="field" htmlFor="register-password-confirmation">
            <span>Confirm password</span>
            <input
              id="register-password-confirmation"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
            />
          </label>

          <button className="button button--primary button--full" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
            {!submitting && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>

        <p className="auth-card__switch">
          Already have an account?{' '}
          <Link to="/login" state={{ from: destination, email: email.trim() || undefined }}>Log in</Link>
        </p>

        <div className="auth-card__note">
          <GraduationCap size={19} aria-hidden="true" />
          <span>Your SFSU email keeps this community student-only.</span>
        </div>
      </section>
    </main>
  )
}

export default RegisterPage
