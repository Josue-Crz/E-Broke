import { Bookmark, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel'
import { useSaved } from '../context/SavedContext'
import { friendlyError } from '../lib/api'
import type { Listing } from '../types'

export function SavedPage() {
  const { refreshSaved } = useSaved()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSaved = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setListings(await refreshSaved())
    } catch (loadError) {
      setError(friendlyError(loadError))
    } finally {
      setLoading(false)
    }
  }, [refreshSaved])

  useEffect(() => {
    void loadSaved()
  }, [loadSaved])

  function handleSavedChange(listingId: number, saved: boolean) {
    if (!saved) {
      setListings((current) => current.filter((listing) => listing.id !== listingId))
    }
  }

  return (
    <main className="page-shell page-shell--wide">
      <header className="page-header">
        <p className="eyebrow">Keep an eye on these</p>
        <h1>Saved items</h1>
        <p>Items you bookmarked show up here until you remove them.</p>
      </header>

      {loading ? (
        <LoadingState message="Loading saved items…" />
      ) : error ? (
        <ErrorState
          message={error}
          action={(
            <button className="button button--secondary" type="button" onClick={() => void loadSaved()}>
              Try again
            </button>
          )}
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved items yet"
          message="Tap the bookmark on any listing to keep it handy here."
          action={(
            <Link className="button button--primary" to="/">
              <Search size={18} aria-hidden="true" /> Browse free items
            </Link>
          )}
        />
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onSavedChange={handleSavedChange}
            />
          ))}
        </div>
      )}
    </main>
  )
}
