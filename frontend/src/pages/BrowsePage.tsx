import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel'
import { api, friendlyError } from '../lib/api'
import { categories, conditions } from '../lib/constants'
import type { Category, Condition, PagedListings } from '../types'

const PAGE_SIZE = 20

function isCategory(value: string | null): value is Category {
  return categories.some((category) => category.value === value)
}

function isCondition(value: string | null): value is Condition {
  return conditions.some((condition) => condition.value === value)
}

function pageFrom(value: string | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export function BrowsePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get('category')
  const conditionParam = searchParams.get('condition')
  const category = isCategory(categoryParam) ? categoryParam : ''
  const condition = isCondition(conditionParam) ? conditionParam : ''
  const neighborhood = searchParams.get('neighborhood')?.trim() ?? ''
  const freeToday = searchParams.get('free_today') === 'true'
  const page = pageFrom(searchParams.get('page'))

  const [searchDraft, setSearchDraft] = useState('')
  const [neighborhoodDraft, setNeighborhoodDraft] = useState(neighborhood)
  const [result, setResult] = useState<PagedListings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    setNeighborhoodDraft(neighborhood)
  }, [neighborhood])

  const requestQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (condition) params.set('condition', condition)
    if (neighborhood) params.set('neighborhood', neighborhood)
    if (freeToday) params.set('free_today', 'true')
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    return params.toString()
  }, [category, condition, freeToday, neighborhood, page])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    api<PagedListings>(`/listings?${requestQuery}`, { signal: controller.signal })
      .then((data) => {
        // The backend cannot report its total on an out-of-range page because
        // its window count has no row. Return to page one instead of leaving
        // the user stranded with no pagination controls.
        if (data.listings.length === 0 && page > 1) {
          const next = new URLSearchParams(requestQuery)
          next.delete('page')
          next.delete('limit')
          setSearchParams(next, { replace: true })
          return
        }
        setResult(data)
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(friendlyError(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [page, requestQuery, retryKey, setSearchParams])

  function updateFilters(updates: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchDraft.trim()
    if (!query) return
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  function submitNeighborhood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateFilters({ neighborhood: neighborhoodDraft.trim() || null })
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    ;['category', 'condition', 'neighborhood', 'free_today', 'page'].forEach((key) =>
      next.delete(key),
    )
    setSearchParams(next)
  }

  function goToPage(nextPage: number) {
    updateFilters({ page: nextPage > 1 ? String(nextPage) : null }, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasFilters = Boolean(category || condition || neighborhood || freeToday)
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1
  const firstItem = result && result.total > 0 ? (result.page - 1) * result.limit + 1 : 0
  const lastItem = result ? Math.min(result.page * result.limit, result.total) : 0

  return (
    <main className="browse-page page-shell">
      <section className="browse-hero" aria-labelledby="browse-heading">
        <div className="browse-hero__copy">
          <span className="eyebrow">SFSU students sharing with SFSU students</span>
          <h1 id="browse-heading">Find what you need. Give what you can.</h1>
          <p>Every item is free—because campus is better when Gators help Gators.</p>
        </div>
        <form className="hero-search" role="search" onSubmit={submitSearch}>
          <Search aria-hidden="true" size={21} />
          <label className="sr-only" htmlFor="browse-search">Search free items</label>
          <input
            id="browse-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Try “somewhere to sit”"
            autoComplete="off"
            maxLength={200}
          />
          <button className="button button--primary" type="submit" disabled={!searchDraft.trim()}>
            Search
          </button>
        </form>
      </section>

      <section className="browse-content" aria-labelledby="listings-heading">
        <div className="browse-content__heading">
          <div>
            <span className="eyebrow">Zero dollars, always</span>
            <h2 id="listings-heading">Free finds near campus</h2>
          </div>
          {result && !loading && (
            <p className="result-count" aria-live="polite">
              {result.total === 0
                ? 'No items'
                : `${firstItem}–${lastItem} of ${result.total} item${result.total === 1 ? '' : 's'}`}
            </p>
          )}
        </div>

        <div className="browse-layout">
          <aside className="filter-panel" aria-label="Filter listings">
            <div className="filter-panel__heading">
              <h3><SlidersHorizontal size={18} aria-hidden="true" /> Filters</h3>
              {hasFilters && (
                <button className="text-button" type="button" onClick={clearFilters}>
                  <X size={15} aria-hidden="true" /> Clear
                </button>
              )}
            </div>

            <label className="field">
              <span>Category</span>
              <select
                value={category}
                onChange={(event) => updateFilters({ category: event.target.value || null })}
              >
                <option value="">All categories</option>
                {categories.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.emoji} {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Condition</span>
              <select
                value={condition}
                onChange={(event) => updateFilters({ condition: event.target.value || null })}
              >
                <option value="">Any condition</option>
                {conditions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <form className="filter-field" onSubmit={submitNeighborhood}>
              <label htmlFor="neighborhood-filter">Neighborhood</label>
              <div className="filter-field__row">
                <input
                  id="neighborhood-filter"
                  value={neighborhoodDraft}
                  onChange={(event) => setNeighborhoodDraft(event.target.value)}
                  placeholder="e.g. Parkmerced"
                  maxLength={120}
                />
                <button className="button button--secondary button--small" type="submit">
                  Apply
                </button>
              </div>
            </form>

            <label className="check-field">
              <input
                type="checkbox"
                checked={freeToday}
                onChange={(event) =>
                  updateFilters({ free_today: event.target.checked ? 'true' : null })
                }
              />
              <span>
                <strong>Posted today</strong>
                <small>See the freshest finds first</small>
              </span>
            </label>
          </aside>

          <div className="listing-results">
            {loading ? (
              <LoadingState message="Finding free stuff…" />
            ) : error ? (
              <ErrorState
                title="We could not load the listings"
                message={error}
                action={(
                  <button className="button button--secondary" type="button" onClick={() => setRetryKey((key) => key + 1)}>
                    Try again
                  </button>
                )}
              />
            ) : result && result.listings.length > 0 ? (
              <>
                <div className="listing-grid">
                  {result.listings.map((listing) => (
                    <ListingCard listing={listing} key={listing.id} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <nav className="pagination" aria-label="Listings pages">
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      disabled={page <= 1}
                      onClick={() => goToPage(page - 1)}
                    >
                      <ChevronLeft size={17} aria-hidden="true" /> Previous
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => goToPage(page + 1)}
                    >
                      Next <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <EmptyState
                title="No free finds match those filters"
                message="Try broadening your filters or check back soon—new items arrive all the time."
                action={hasFilters ? (
                  <button className="button button--secondary" type="button" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : undefined}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default BrowsePage
