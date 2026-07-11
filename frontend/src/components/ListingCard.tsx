import { Bookmark, MapPin } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSaved } from '../context/SavedContext'
import { useToast } from '../context/ToastContext'
import { authRedirectFor, friendlyError } from '../lib/api'
import {
  categoryEmoji,
  categoryLabel,
  conditionLabel,
  DEFAULT_IMAGE,
} from '../lib/constants'
import { formatRelativeDate } from '../lib/format'
import type { Listing } from '../types'

interface ListingCardProps {
  listing: Listing
  onSavedChange?: (listingId: number, saved: boolean) => void
}

export function ListingCard({ listing, onSavedChange }: ListingCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isSaved, toggleSaved } = useSaved()
  const { showToast } = useToast()
  const saved = isSaved(listing.id)

  async function handleSave() {
    try {
      const next = await toggleSaved(listing.id)
      onSavedChange?.(listing.id, next)
      showToast(next ? 'Saved for later.' : 'Removed from saved items.', 'success')
    } catch (error) {
      const redirect = authRedirectFor(error)
      if (redirect) {
        navigate(redirect, { state: { from: location.pathname } })
        return
      }
      showToast(friendlyError(error), 'error')
    }
  }

  return (
    <article className="listing-card">
      <Link className="listing-card__image-wrap" to={`/listings/${listing.id}`} aria-label={`View ${listing.title}`}>
        <img
          className="listing-card__image"
          src={listing.photoUrls[0] || DEFAULT_IMAGE}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = DEFAULT_IMAGE
          }}
        />
        <span className="free-pill">FREE</span>
        {listing.status !== 'active' && (
          <span className="status-pill status-pill--image">{listing.status}</span>
        )}
      </Link>
      <button
        className={`save-button${saved ? ' save-button--active' : ''}`}
        type="button"
        aria-label={saved ? `Unsave ${listing.title}` : `Save ${listing.title}`}
        aria-pressed={saved}
        onClick={handleSave}
      >
        <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <div className="listing-card__body">
        <div className="listing-card__eyebrow">
          <span>{categoryEmoji(listing.category)} {categoryLabel(listing.category)}</span>
          <span>{formatRelativeDate(listing.createdAt)}</span>
        </div>
        <h3><Link to={`/listings/${listing.id}`}>{listing.title}</Link></h3>
        <div className="listing-card__meta">
          <span className="condition-pill">{conditionLabel(listing.condition)}</span>
          {listing.neighborhood && (
            <span><MapPin size={14} aria-hidden="true" /> {listing.neighborhood}</span>
          )}
        </div>
      </div>
    </article>
  )
}
