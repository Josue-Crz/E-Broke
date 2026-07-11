import { Bell, Check, Gift, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel'
import { useToast } from '../context/ToastContext'
import { api, friendlyError } from '../lib/api'
import { formatRelativeDate } from '../lib/format'
import type { AppNotification } from '../types'

function notificationText(notification: AppNotification) {
  const title = notification.payload.listingTitle ?? 'a free item'

  if (notification.type === 'wishlist_match') {
    const query = notification.payload.queryText
    return {
      heading: 'A wish alert found a match',
      detail: typeof query === 'string'
        ? `“${title}” may match your alert for “${query}.”`
        : `“${title}” may be just what you were looking for.`,
      Icon: Sparkles,
    }
  }

  if (notification.type === 'listing_claimed') {
    const claimedBy = notification.payload.claimedBy?.name
    return {
      heading: 'Your item was claimed',
      detail: claimedBy
        ? `${claimedBy} claimed “${title}.” Reach out to arrange the handoff.`
        : `Someone claimed “${title}.” Reach out to arrange the handoff.`,
      Icon: Gift,
    }
  }

  return {
    heading: 'e-Broke update',
    detail: title === 'a free item'
      ? 'There is a new update on your account.'
      : `There is an update about “${title}.”`,
    Icon: Bell,
  }
}

export function NotificationsPage() {
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingIds, setMarkingIds] = useState<Set<number>>(new Set())

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api<{ notifications: AppNotification[] }>('/notifications')
      setNotifications(result.notifications)
    } catch (loadError) {
      setError(friendlyError(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  async function markRead(notification: AppNotification) {
    if (notification.readAt || markingIds.has(notification.id)) return

    setMarkingIds((current) => new Set(current).add(notification.id))
    try {
      await api<{ ok: boolean }>(`/notifications/${notification.id}/read`, { method: 'POST' })
      setNotifications((current) => current.map((item) => (
        item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item
      )))
    } catch (markError) {
      showToast(friendlyError(markError), 'error')
    } finally {
      setMarkingIds((current) => {
        const next = new Set(current)
        next.delete(notification.id)
        return next
      })
    }
  }

  return (
    <main className="page-shell page-shell--narrow">
      <header className="page-header">
        <p className="eyebrow">What is happening</p>
        <h1>Notifications</h1>
        <p>Matches, claims, and other useful updates from e-Broke.</p>
      </header>

      {loading ? (
        <LoadingState message="Loading notifications…" />
      ) : error ? (
        <ErrorState
          message={error}
          action={(
            <button className="button button--secondary" type="button" onClick={() => void loadNotifications()}>
              Try again
            </button>
          )}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You are all caught up"
          message="Wish-list matches and listing claims will appear here."
        />
      ) : (
        <ul className="notification-list">
          {notifications.map((notification) => {
            const { heading, detail, Icon } = notificationText(notification)
            const listingId = notification.payload.listingId
            const isUnread = !notification.readAt
            const content = (
              <>
                <span className="notification-item__icon"><Icon size={21} aria-hidden="true" /></span>
                <span className="notification-item__body">
                  <strong>{heading}</strong>
                  <span>{detail}</span>
                  <time dateTime={notification.createdAt}>{formatRelativeDate(notification.createdAt)}</time>
                </span>
              </>
            )

            return (
              <li
                className={`notification-item${isUnread ? ' notification-item--unread' : ''}`}
                key={notification.id}
              >
                {listingId ? (
                  <Link
                    className="notification-item__link"
                    to={`/listings/${listingId}`}
                    onClick={() => void markRead(notification)}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="notification-item__content">{content}</div>
                )}
                {isUnread ? (
                  <button
                    className="button button--ghost button--small notification-item__read"
                    type="button"
                    disabled={markingIds.has(notification.id)}
                    onClick={() => void markRead(notification)}
                  >
                    <Check size={16} aria-hidden="true" />
                    {markingIds.has(notification.id) ? 'Marking…' : 'Mark read'}
                  </button>
                ) : (
                  <span className="notification-item__read-state"><Check size={15} aria-hidden="true" /> Read</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
