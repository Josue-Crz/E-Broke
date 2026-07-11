import { BellRing, Plus, Sparkles, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel'
import { useToast } from '../context/ToastContext'
import { api, friendlyError } from '../lib/api'
import { formatRelativeDate } from '../lib/format'
import type { WishlistAlert } from '../types'

export function WishlistPage() {
  const { showToast } = useToast()
  const [alerts, setAlerts] = useState<WishlistAlert[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api<{ alerts: WishlistAlert[] }>('/wishlist-alerts')
      setAlerts(result.alerts)
    } catch (loadError) {
      setError(friendlyError(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAlerts()
  }, [loadAlerts])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const queryText = query.trim()
    if (queryText.length < 2) {
      setFormError('Describe what you are looking for in at least 2 characters.')
      return
    }

    setCreating(true)
    setFormError(null)
    try {
      const result = await api<{ alert: WishlistAlert }>('/wishlist-alerts', {
        method: 'POST',
        body: { queryText },
      })
      setAlerts((current) => [result.alert, ...current])
      setQuery('')
      showToast('Wish alert created. We will keep watch for a match.', 'success')
    } catch (createError) {
      const message = friendlyError(createError)
      setFormError(message)
      showToast(message, 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(alert: WishlistAlert) {
    setDeletingId(alert.id)
    try {
      await api<{ ok: boolean }>(`/wishlist-alerts/${alert.id}`, { method: 'DELETE' })
      setAlerts((current) => current.filter((item) => item.id !== alert.id))
      showToast('Wish alert removed.', 'success')
    } catch (deleteError) {
      showToast(friendlyError(deleteError), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="page-shell page-shell--narrow">
      <header className="page-header">
        <p className="eyebrow">Let e-Broke keep watch</p>
        <h1>Wish alerts</h1>
        <p>Describe what you need. We will let you know when a similar free item is posted.</p>
      </header>

      <section className="panel wishlist-create" aria-labelledby="wishlist-create-title">
        <span className="panel__icon"><Sparkles aria-hidden="true" /></span>
        <div className="wishlist-create__content">
          <h2 id="wishlist-create-title">What are you hoping to find?</h2>
          <p>Try something natural, like “a lamp for my desk” or “an intro biology textbook.”</p>
          <form className="inline-form" onSubmit={handleCreate}>
            <div className="field field--grow">
              <label className="sr-only" htmlFor="wishlist-query">Item description</label>
              <input
                id="wishlist-query"
                name="queryText"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  if (formError) setFormError(null)
                }}
                minLength={2}
                maxLength={200}
                placeholder="e.g. a small bookshelf"
                aria-describedby={formError ? 'wishlist-form-error' : undefined}
                aria-invalid={Boolean(formError)}
                disabled={creating}
              />
              {formError && <p className="field-error" id="wishlist-form-error" role="alert">{formError}</p>}
            </div>
            <button
              className="button button--primary"
              type="submit"
              disabled={creating || query.trim().length < 2}
            >
              <Plus size={18} aria-hidden="true" /> {creating ? 'Creating…' : 'Create alert'}
            </button>
          </form>
        </div>
      </section>

      <section className="wishlist-list" aria-labelledby="wishlist-list-title">
        <div className="section-heading">
          <div>
            <h2 id="wishlist-list-title">Your active alerts</h2>
            {!loading && !error && <p>{alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}</p>}
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading your wish alerts…" />
        ) : error ? (
          <ErrorState
            compact
            message={error}
            action={(
              <button className="button button--secondary" type="button" onClick={() => void loadAlerts()}>
                Try again
              </button>
            )}
          />
        ) : alerts.length === 0 ? (
          <EmptyState
            compact
            icon={BellRing}
            title="No active alerts"
            message="Create one above and we will look for close matches in new listings."
          />
        ) : (
          <ul className="wishlist-items">
            {alerts.map((alert) => (
              <li className="wishlist-item" key={alert.id}>
                <span className="wishlist-item__icon"><BellRing size={20} aria-hidden="true" /></span>
                <div className="wishlist-item__body">
                  <strong>{alert.queryText}</strong>
                  <span>Watching since {formatRelativeDate(alert.createdAt)}</span>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Delete alert for ${alert.queryText}`}
                  title="Delete alert"
                  disabled={deletingId === alert.id}
                  onClick={() => void handleDelete(alert)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
