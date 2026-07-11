import { ArrowRight, KeyRound, MailCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, friendlyError } from '../lib/api'
import type { User } from '../types'

interface VerifyLocationState {
  from?: string
  email?: string
  devVerificationCode?: string
}

function safeDestination(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function isSfsuEmail(email: string) {
  return /^[^\s@]+@sfsu\.edu$/i.test(email.trim())
}

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser } = useAuth()
  const { showToast } = useToast()
  const routeState = (location.state ?? {}) as VerifyLocationState
  const destination = safeDestination(routeState.from)
  const devVerificationCode = routeState.devVerificationCode
  const [email, setEmail] = useState(routeState.email ?? user?.email ?? '')
  const [code, setCode] = useState(devVerificationCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedCode = code.trim()

    if (!isSfsuEmail(normalizedEmail)) {
      setError('Use the @sfsu.edu email address you registered with.')
      return
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError('Enter the 6-digit verification code.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await api<{ user: User }>('/auth/verify-email', {
        method: 'POST',
        body: { email: normalizedEmail, code: normalizedCode },
      })
      setUser(result.user)
      showToast('Email verified. Welcome to e-Broke!', 'success')
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(friendlyError(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page page-shell">
      <section className="auth-card" aria-labelledby="verify-heading">
        <div className="auth-card__icon" aria-hidden="true"><MailCheck /></div>
        <div className="auth-card__heading">
          <span className="eyebrow">One last step</span>
          <h1 id="verify-heading">Verify your SFSU email</h1>
          <p>Enter the six-digit code for your campus email to unlock posting, claiming, and messaging.</p>
        </div>

        {devVerificationCode && (
          <div className="dev-code" role="status">
            <KeyRound size={20} aria-hidden="true" />
            <div>
              <strong>Local development code</strong>
              <code>{devVerificationCode}</code>
              <small>The code has been filled in below. It expires in 15 minutes.</small>
            </div>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}

          <label className="field" htmlFor="verify-email">
            <span>SFSU email</span>
            <input
              id="verify-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@sfsu.edu"
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>

          <label className="field" htmlFor="verification-code">
            <span>Verification code</span>
            <input
              className="verification-code-input"
              id="verification-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
            />
          </label>

          <button className="button button--primary button--full" type="submit" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify email'}
            {!submitting && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>

        <p className="auth-card__switch">
          Wrong account?{' '}
          <Link to="/login" state={{ from: destination, email: email.trim() || undefined }}>
            Return to login
          </Link>
        </p>
      </section>
    </main>
  )
}

export default VerifyEmailPage
