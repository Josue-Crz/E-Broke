import { BellPlus, Search, Sparkles } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, friendlyError } from '../lib/api'
import type { Listing, WishlistAlert } from '../types'

interface SearchResponse {
  query: string
  results: Listing[]
}

export function SearchPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const submittedQuery = searchParams.get('q')?.trim() ?? ''
  const [draft, setDraft] = useState(submittedQuery)
  const [results, setResults] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [creatingAlert, setCreatingAlert] = useState(false)
  const [alertCreatedFor, setAlertCreatedFor] = useState<string | null>(null)
  const requestRef = useRef<{ key: string; promise: Promise<SearchResponse> } | null>(null)

  useEffect(() => {
    setDraft(submittedQuery)
    setAlertCreatedFor(null)
  }, [submittedQuery])

  useEffect(() => {
    if (!submittedQuery) {
      setResults([])
      setError(null)
      setErrorCode(null)
      setLoading(false)
      return
    }

    if (submittedQuery.length < 2) {
      setResults([])
      setError('Search with at least two characters so we can find a useful match.')
      setErrorCode('VALIDATION_ERROR')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    setErrorCode(null)

    const requestKey = `${submittedQuery}:${retryKey}`
    const request = requestRef.current?.key === requestKey
      ? requestRef.current.promise
      : api<SearchResponse>(`/search?q=${encodeURIComponent(submittedQuery)}`)
    requestRef.current = { key: requestKey, promise: request }

    request
      .then((data) => {
        if (active) setResults(data.results)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setResults([])
        setError(friendlyError(requestError))
        setErrorCode(requestError instanceof ApiError ? requestError.code : 'UNKNOWN')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [retryKey, submittedQuery])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = draft.trim()
    if (query.length < 2) {
      setFormError('Enter at least two characters to search.')
      return
    }

    setFormError(null)
    if (loading && query === submittedQuery) return
    if (query === submittedQuery) {
      setRetryKey((key) => key + 1)
    } else {
      setSearchParams({ q: query })
    }
  }

  async function createWishlistAlert() {
    if (!user || !submittedQuery || creatingAlert) return
    setCreatingAlert(true)
    try {
      await api<{ alert: WishlistAlert }>('/wishlist-alerts', {
        method: 'POST',
        body: { queryText: submittedQuery },
      })
      setAlertCreatedFor(submittedQuery)
      showToast(`We’ll let you know when “${submittedQuery}” shows up.`, 'success')
    } catch (requestError) {
      showToast(friendlyError(requestError), 'error')
    } finally {
      setCreatingAlert(false)
    }
  }

  const aiUnavailable = errorCode === 'AI_UNAVAILABLE' || errorCode === 'HTTP_502'
  const rateLimited = errorCode === 'RATE_LIMITED' || errorCode === 'HTTP_429'
  const currentPath = `${location.pathname}${location.search}`

  return (
    <main className="search-page page-shell">
      <header className="page-heading search-page__heading">
        <span className="eyebrow"><Sparkles size={16} aria-hidden="true" /> Meaning-aware search</span>
        <h1>Search the way you think</h1>
        <p>Describe what you need in your own words. We’ll look for the closest free matches.</p>
      </header>

      <form className="search-form search-form--large" role="search" onSubmit={submitSearch}>
        <Search aria-hidden="true" size={22} />
        <label className="sr-only" htmlFor="semantic-search">Search free items</label>
        <input
          id="semantic-search"
          type="search"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (formError) setFormError(null)
          }}
          placeholder="Try “a lamp for late-night studying”"
          autoComplete="off"
          maxLength={200}
          aria-describedby={formError ? 'search-form-error' : 'search-help'}
        />
        <button
          className="button button--primary"
          type="submit"
          disabled={loading && draft.trim() === submittedQuery}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {formError ? (
        <p className="field-error" id="search-form-error" role="alert">{formError}</p>
      ) : (
        <p className="form-help" id="search-help">Search runs only when you submit, helping conserve AI requests.</p>
      )}

      {!submittedQuery ? (
        <EmptyState
          icon={Search}
          title="What are you looking for?"
          message="Try an item name, a use, or even a problem you want to solve."
        />
      ) : loading ? (
        <LoadingState message={`Looking for “${submittedQuery}”…`} />
      ) : error ? (
        <ErrorState
          title={
            aiUnavailable
              ? 'Search is taking a breather'
              : rateLimited
                ? 'Let’s pause for a moment'
                : 'We could not complete that search'
          }
          message={error}
          action={errorCode === 'VALIDATION_ERROR' ? undefined : (
            <button className="button button--secondary" type="button" onClick={() => setRetryKey((key) => key + 1)}>
              Try again
            </button>
          )}
        />
      ) : (
        <section className="search-results" aria-labelledby="search-results-heading">
          <div className="search-results__heading">
            <div>
              <span className="eyebrow">Best semantic matches</span>
              <h2 id="search-results-heading">Results for “{submittedQuery}”</h2>
              <p>{results.length} match{results.length === 1 ? '' : 'es'} found</p>
            </div>
            {user ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={createWishlistAlert}
                disabled={creatingAlert || alertCreatedFor === submittedQuery}
              >
                <BellPlus size={17} aria-hidden="true" />
                {alertCreatedFor === submittedQuery
                  ? 'Alert created'
                  : creatingAlert
                    ? 'Creating alert…'
                    : 'Alert me about this'}
              </button>
            ) : (
              <Link className="text-link search-results__login" to="/login" state={{ from: currentPath }}>
                Log in to create a wish alert
              </Link>
            )}
          </div>

          {results.length > 0 ? (
            <div className="listing-grid">
              {results.map((listing) => <ListingCard listing={listing} key={listing.id} />)}
            </div>
          ) : (
            <EmptyState
              title="No close matches yet"
              message={
                user
                  ? 'Create a wish alert and we’ll notify you when a matching item is posted.'
                  : 'Try another phrase, or log in to create a wish alert for this search.'
              }
              action={user ? (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={createWishlistAlert}
                  disabled={creatingAlert || alertCreatedFor === submittedQuery}
                >
                  <BellPlus size={17} aria-hidden="true" />
                  {alertCreatedFor === submittedQuery ? 'Alert created' : 'Create wish alert'}
                </button>
              ) : undefined}
            />
          )}
        </section>
      )}
    </main>
  )
}

export default SearchPage
