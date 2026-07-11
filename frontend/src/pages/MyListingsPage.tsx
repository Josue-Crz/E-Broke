import { PackageOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel'
import { useToast } from '../context/ToastContext'
import { api, friendlyError } from '../lib/api'
import type { Listing } from '../types'

export function MyListingsPage() {
  const { showToast } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api<{ listings: Listing[] }>('/me/listings')
      setListings(result.listings)
    } catch (loadError) {
      setError(friendlyError(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadListings()
  }, [loadListings])

  async function handleDelete(listing: Listing) {
    const confirmed = window.confirm(
      `Remove “${listing.title}”? This listing will no longer appear on e-Broke.`,
    )
    if (!confirmed) return

    setDeletingId(listing.id)
    try {
      await api<{ ok: boolean }>(`/listings/${listing.id}`, { method: 'DELETE' })
      setListings((current) => current.filter((item) => item.id !== listing.id))
      showToast('Listing removed.', 'success')
    } catch (deleteError) {
      showToast(friendlyError(deleteError), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="page-shell page-shell--wide">
      <header className="page-header page-header--split">
        <div>
          <p className="eyebrow">Your generosity</p>
          <h1>My listings</h1>
          <p>Manage the things you are sharing with fellow Gators.</p>
        </div>
        <Link className="button button--primary" to="/listings/new">
          <Plus size={18} aria-hidden="true" /> Post an item
        </Link>
      </header>

      {loading ? (
        <LoadingState message="Loading your listings…" />
      ) : error ? (
        <ErrorState
          message={error}
          action={(
            <button className="button button--secondary" type="button" onClick={() => void loadListings()}>
              Try again
            </button>
          )}
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="You have not posted anything yet"
          message="Have something useful you no longer need? Pass it along for free."
          action={(
            <Link className="button button--primary" to="/listings/new">
              <Plus size={18} aria-hidden="true" /> Post your first item
            </Link>
          )}
        />
      ) : (
        <div className="listing-grid listing-grid--managed">
          {listings.map((listing) => (
            <div className="managed-listing" key={listing.id}>
              <ListingCard listing={listing} />
              <div className="managed-listing__actions">
                <Link className="button button--secondary button--small" to={`/listings/${listing.id}/edit`}>
                  <Pencil size={16} aria-hidden="true" /> Edit
                </Link>
                <button
                  className="button button--danger button--small"
                  type="button"
                  onClick={() => void handleDelete(listing)}
                  disabled={deletingId === listing.id}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {deletingId === listing.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
