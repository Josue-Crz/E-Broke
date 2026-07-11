import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  PackageCheck,
  Pencil,
  ShieldCheck,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ErrorState, LoadingState } from '../components/StatePanel'
import { useAuth } from '../context/AuthContext'
import { useSaved } from '../context/SavedContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, authRedirectFor, friendlyError } from '../lib/api'
import {
  categoryEmoji,
  categoryLabel,
  conditionLabel,
  DEFAULT_IMAGE,
} from '../lib/constants'
import { formatRelativeDate } from '../lib/format'
import type { Listing } from '../types'

function usablePhotos(listing: Listing): string[] {
  const photos = listing.photoUrls.filter((url) => url.trim().length > 0)
  return photos.length > 0 ? photos : [DEFAULT_IMAGE]
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null
  event.currentTarget.src = DEFAULT_IMAGE
}

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const listingId = Number(id)
  const validId = Number.isInteger(listingId) && listingId > 0
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { isSaved, toggleSaved } = useSaved()
  const { showToast } = useToast()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(validId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [saving, setSaving] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimedHere, setClaimedHere] = useState(false)
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState<string | null>(null)
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    if (!validId) {
      setListing(null)
      setLoadError('That listing address is not valid.')
      setLoading(false)
      return
    }

    let current = true
    setLoading(true)
    setLoadError(null)

    api<{ listing: Listing }>(`/listings/${listingId}`)
      .then(({ listing: nextListing }) => {
        if (!current) return
        setListing(nextListing)
        setSelectedPhoto(0)
        setClaimedHere(false)
      })
      .catch((error: unknown) => {
        if (!current) return
        const message =
          error instanceof ApiError && error.status === 404
            ? 'This item is no longer available or could not be found.'
            : friendlyError(error)
        setLoadError(message)
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [listingId, loadAttempt, validId])

  const redirectForAuthError = (error: unknown): boolean => {
    const redirect = authRedirectFor(error)
    if (!redirect) return false
    navigate(redirect, {
      state: { from: `${location.pathname}${location.search}` },
    })
    return true
  }

  async function handleSave() {
    if (!listing || saving) return
    setSaving(true)
    try {
      const saved = await toggleSaved(listing.id)
      showToast(saved ? 'Saved for later.' : 'Removed from saved items.', 'success')
    } catch (error) {
      if (!redirectForAuthError(error)) showToast(friendlyError(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClaim() {
    if (!listing || claiming) return
    if (user?.id === listing.userId) {
      showToast('This is your item, so it cannot be claimed by you.', 'info')
      return
    }
    if (listing.status !== 'active') {
      showToast('This item has already been claimed.', 'info')
      return
    }

    setClaiming(true)
    try {
      const result = await api<{ listing: Listing }>(`/listings/${listing.id}/claim`, {
        method: 'POST',
      })
      setListing((current) =>
        current
          ? { ...current, ...result.listing, owner: current.owner }
          : result.listing,
      )
      setClaimedHere(true)
      showToast('It is yours! Message the giver to arrange pickup.', 'success')
    } catch (error) {
      if (redirectForAuthError(error)) return
      if (error instanceof ApiError && error.code === 'ALREADY_CLAIMED') {
        setListing((current) => (current ? { ...current, status: 'claimed' } : current))
      }
      showToast(friendlyError(error), 'error')
    } finally {
      setClaiming(false)
    }
  }

  async function handleMessageOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!listing || sendingMessage) return
    if (user?.id === listing.userId) {
      showToast('This is your listing. Messages from interested Gators will appear in your inbox.', 'info')
      return
    }
    if (listing.status !== 'active' && !claimedHere) {
      setMessageError('This item is no longer available for a new conversation.')
      return
    }

    const body = message.trim()
    if (!body) {
      setMessageError('Write a quick note to the giver first.')
      return
    }

    setSendingMessage(true)
    setMessageError(null)
    try {
      const result = await api<{ conversationId: number }>('/conversations', {
        method: 'POST',
        body: { listingId: listing.id, message: body },
      })
      showToast('Message sent.', 'success')
      navigate(`/messages/${result.conversationId}`)
    } catch (error) {
      if (redirectForAuthError(error)) return
      const nextMessage = friendlyError(error)
      setMessageError(nextMessage)
      showToast(nextMessage, 'error')
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading) {
    return (
      <main className="page page--listing-detail">
        <div className="page-shell"><LoadingState message="Loading this free find…" /></div>
      </main>
    )
  }

  if (!listing || loadError) {
    return (
      <main className="page page--listing-detail">
        <div className="page-shell">
          <ErrorState
            title="We could not open this listing"
            message={loadError ?? 'This item could not be found.'}
            action={
              <div className="state-panel__actions">
                {validId && (
                  <button className="button button--secondary" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                    Try again
                  </button>
                )}
                <Link className="button button--primary" to="/">Browse other items</Link>
              </div>
            }
          />
        </div>
      </main>
    )
  }

  const photos = usablePhotos(listing)
  const photoIndex = Math.min(selectedPhoto, photos.length - 1)
  const ownerName = listing.owner?.name ?? 'SFSU Gator'
  const ownListing = user?.id === listing.userId
  const saved = isSaved(listing.id)

  return (
    <main className="page page--listing-detail">
      <div className="page-shell">
        <Link className="back-link" to="/"><ChevronLeft size={17} /> Back to browse</Link>

        <div className="listing-detail">
          <section className="listing-gallery" aria-label={`${listing.title} photos`}>
            <div className="listing-gallery__main">
              <img src={photos[photoIndex]} alt={listing.title} onError={imageFallback} />
              <span className="free-pill free-pill--large">FREE</span>
              {listing.status !== 'active' && (
                <span className="status-pill status-pill--image">{listing.status}</span>
              )}
              {photos.length > 1 && (
                <>
                  <button
                    className="gallery-arrow gallery-arrow--previous"
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => setSelectedPhoto((photoIndex - 1 + photos.length) % photos.length)}
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    className="gallery-arrow gallery-arrow--next"
                    type="button"
                    aria-label="Next photo"
                    onClick={() => setSelectedPhoto((photoIndex + 1) % photos.length)}
                  >
                    <ChevronRight />
                  </button>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="listing-gallery__thumbnails" aria-label="Choose a photo">
                {photos.map((photo, index) => (
                  <button
                    className={index === photoIndex ? 'gallery-thumbnail gallery-thumbnail--active' : 'gallery-thumbnail'}
                    type="button"
                    key={`${photo}-${index}`}
                    aria-label={`Show photo ${index + 1}`}
                    aria-pressed={index === photoIndex}
                    onClick={() => setSelectedPhoto(index)}
                  >
                    <img src={photo} alt="" onError={imageFallback} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <article className="listing-detail__content">
            <header className="listing-detail__header">
              <div className="listing-detail__eyebrow">
                <span>{categoryEmoji(listing.category)} {categoryLabel(listing.category)}</span>
                <span>{formatRelativeDate(listing.createdAt)}</span>
              </div>
              <div className="listing-detail__title-row">
                <h1>{listing.title}</h1>
                <button
                  className={`save-button save-button--detail${saved ? ' save-button--active' : ''}`}
                  type="button"
                  aria-label={saved ? `Unsave ${listing.title}` : `Save ${listing.title}`}
                  aria-pressed={saved}
                  disabled={saving}
                  onClick={handleSave}
                >
                  <Bookmark size={21} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="listing-detail__meta">
                <span className="condition-pill">{conditionLabel(listing.condition)}</span>
                {listing.neighborhood && <span><MapPin size={16} /> {listing.neighborhood}</span>}
                <span className={`status-pill status-pill--${listing.status}`}>{listing.status}</span>
              </div>
            </header>

            <section className="listing-detail__description">
              <h2>About this item</h2>
              <p>{listing.description}</p>
            </section>

            <section className="listing-owner" aria-label="Item giver">
              <Avatar name={ownerName} src={listing.owner?.avatarUrl} size="large" />
              <div>
                <span className="listing-owner__label">Offered by</span>
                <strong>{ownerName}</strong>
                <span className="listing-owner__verified"><ShieldCheck size={15} /> SFSU community</span>
              </div>
            </section>

            <aside className="listing-actions">
              {ownListing ? (
                <div className="owner-actions">
                  <div>
                    <strong>This is your listing</strong>
                    <p>{listing.status === 'active' ? 'You can update its details anytime.' : 'This item has already been claimed.'}</p>
                  </div>
                  <Link className="button button--secondary" to={`/listings/${listing.id}/edit`}>
                    <Pencil size={17} /> Edit listing
                  </Link>
                </div>
              ) : listing.status === 'active' || claimedHere ? (
                <>
                  {claimedHere ? (
                    <div className="claim-callout claim-callout--success" role="status">
                      <PackageCheck aria-hidden="true" />
                      <div>
                        <strong>You claimed this item</strong>
                        <span>Send the giver a note to arrange the handoff.</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="claim-callout">
                        <PackageCheck aria-hidden="true" />
                        <div>
                          <strong>Ready to give it a new home?</strong>
                          <span>Claims are first come, first served.</span>
                        </div>
                      </div>
                      <button className="button button--primary button--wide" type="button" disabled={claiming} onClick={handleClaim}>
                        <PackageCheck size={18} /> {claiming ? 'Claiming…' : 'Claim this item'}
                      </button>
                    </>
                  )}

                  <form className="message-owner-form" onSubmit={handleMessageOwner}>
                    <label htmlFor="owner-message">Ask the giver a question</label>
                    <textarea
                      id="owner-message"
                      value={message}
                      maxLength={2000}
                      rows={3}
                      placeholder={`Hi ${ownerName.split(' ')[0]}, is this still available?`}
                      aria-invalid={Boolean(messageError)}
                      aria-describedby={messageError ? 'owner-message-error' : undefined}
                      onChange={(event) => {
                        setMessage(event.target.value)
                        if (messageError) setMessageError(null)
                      }}
                    />
                    {messageError && <p className="field-error" id="owner-message-error" role="alert">{messageError}</p>}
                    <button className="button button--secondary button--wide" type="submit" disabled={sendingMessage}>
                      <MessageCircle size={18} /> {sendingMessage ? 'Sending…' : 'Message owner'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="listing-unavailable" role="status">
                  <PackageCheck aria-hidden="true" />
                  <div>
                    <strong>This item has been claimed</strong>
                    <p>Browse the latest listings to find another free gem.</p>
                  </div>
                  <Link className="button button--secondary" to="/">See available items</Link>
                </div>
              )}
            </aside>
          </article>
        </div>
      </div>
    </main>
  )
}
