import { ArrowLeft, Inbox, MessageCircle, Search, Send } from 'lucide-react'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, authRedirectFor, friendlyError } from '../lib/api'
import { DEFAULT_IMAGE } from '../lib/constants'
import { formatRelativeDate } from '../lib/format'
import type { Conversation, Message } from '../types'

interface ThreadState {
  conversationId: number | null
  messages: Message[]
}

export function MessagesPage() {
  const params = useParams<{ conversationId?: string; id?: string }>()
  const rawConversationId = params.conversationId ?? params.id
  const parsedConversationId = rawConversationId ? Number(rawConversationId) : null
  const conversationId = parsedConversationId !== null
    && Number.isInteger(parsedConversationId)
    && parsedConversationId > 0
    ? parsedConversationId
    : null
  const invalidConversationId = rawConversationId !== undefined && conversationId === null

  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadState>({ conversationId: null, messages: [] })
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [threadReloadKey, setThreadReloadKey] = useState(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRequestInFlight = useRef(false)
  const hasLoadedConversations = useRef(false)
  const mounted = useRef(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadConversations = useCallback(async (quiet = false) => {
    if (document.hidden || listRequestInFlight.current) return
    listRequestInFlight.current = true
    const showStatus = !quiet || !hasLoadedConversations.current
    if (showStatus) {
      setListLoading(true)
      setListError(null)
    }

    try {
      const result = await api<{ conversations: Conversation[] }>('/conversations')
      if (mounted.current) {
        hasLoadedConversations.current = true
        setConversations(result.conversations)
        setListError(null)
      }
    } catch (loadError) {
      const redirect = authRedirectFor(loadError)
      if (redirect) {
        navigate(redirect, { replace: true })
      } else if (showStatus && mounted.current) {
        setListError(friendlyError(loadError))
      }
    } finally {
      listRequestInFlight.current = false
      if (showStatus && mounted.current) setListLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void loadConversations()

    const timer = window.setInterval(() => {
      void loadConversations(true)
    }, 8000)
    const handleVisibility = () => {
      if (!document.hidden) void loadConversations(true)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadConversations])

  useEffect(() => {
    if (!conversationId) {
      setMessagesLoading(false)
      setMessagesError(null)
      return
    }

    let stopped = false
    let requestInFlight = false
    let hasLoaded = false
    setMessagesLoading(true)
    setMessagesError(null)

    const loadMessages = async () => {
      if (document.hidden || requestInFlight) return
      requestInFlight = true
      try {
        const result = await api<{ messages: Message[] }>(`/conversations/${conversationId}/messages`)
        if (stopped) return
        hasLoaded = true
        setThread({ conversationId, messages: result.messages })
        setMessagesError(null)
        setConversations((current) => current.map((conversation) => (
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )))
        window.dispatchEvent(new Event('ebroke:messages-read'))
      } catch (loadError) {
        if (stopped) return
        const redirect = authRedirectFor(loadError)
        if (redirect) {
          navigate(redirect, { replace: true })
        } else if (!hasLoaded) {
          setMessagesError(friendlyError(loadError))
        }
      } finally {
        requestInFlight = false
        if (!stopped) setMessagesLoading(false)
      }
    }

    void loadMessages()
    const timer = window.setInterval(() => {
      void loadMessages()
    }, 4000)
    const handleVisibility = () => {
      if (!document.hidden) void loadMessages()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [conversationId, navigate, threadReloadKey])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) ?? null,
    [conversationId, conversations],
  )
  const visibleMessages = thread.conversationId === conversationId ? thread.messages : []

  useEffect(() => {
    if (thread.conversationId !== conversationId) return
    messagesEndRef.current?.scrollIntoView?.({ block: 'end' })
  }, [conversationId, thread])

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!conversationId || !body || sending) return

    setSending(true)
    try {
      const result = await api<{ message: Message }>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body },
      })
      setThread((current) => {
        if (current.conversationId !== conversationId) {
          return { conversationId, messages: [result.message] }
        }
        if (current.messages.some((message) => message.id === result.message.id)) return current
        return { ...current, messages: [...current.messages, result.message] }
      })
      setDraft('')
      setConversations((current) => {
        const selected = current.find((conversation) => conversation.id === conversationId)
        if (!selected) return current
        const updated = {
          ...selected,
          lastMessage: result.message.body,
          lastMessageAt: result.message.createdAt,
        }
        return [updated, ...current.filter((conversation) => conversation.id !== conversationId)]
      })
      void loadConversations(true)
    } catch (sendError) {
      const redirect = authRedirectFor(sendError)
      if (redirect) {
        navigate(redirect, { replace: true })
      } else {
        showToast(friendlyError(sendError), 'error')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <main className={`page-shell page-shell--wide messages-page${conversationId ? ' messages-page--thread-open' : ''}`}>
      <header className="page-header messages-page__heading">
        <p className="eyebrow">Coordinate the handoff</p>
        <h1>Messages</h1>
      </header>

      <div className="messages-layout">
        <aside className="messages-sidebar" aria-label="Conversations">
          <div className="messages-sidebar__header">
            <h2>Conversations</h2>
          </div>

          {listLoading ? (
            <LoadingState message="Loading conversations…" />
          ) : listError ? (
            <ErrorState
              compact
              message={listError}
              action={(
                <button className="button button--secondary button--small" type="button" onClick={() => void loadConversations()}>
                  Try again
                </button>
              )}
            />
          ) : conversations.length === 0 ? (
            <EmptyState
              compact
              icon={Inbox}
              title="No conversations yet"
              message="Ask about an item and the conversation will appear here."
            />
          ) : (
            <ul className="conversation-list">
              {conversations.map((conversation) => {
                const active = conversation.id === conversationId
                const activityAt = conversation.lastMessageAt ?? conversation.createdAt
                return (
                  <li key={conversation.id}>
                    <Link
                      className={`conversation-preview${active ? ' conversation-preview--active' : ''}`}
                      to={`/messages/${conversation.id}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Avatar name={conversation.otherUser.name} src={conversation.otherUser.avatarUrl} />
                      <span className="conversation-preview__body">
                        <span className="conversation-preview__topline">
                          <strong>{conversation.otherUser.name}</strong>
                          <time dateTime={activityAt}>{formatRelativeDate(activityAt)}</time>
                        </span>
                        <span className="conversation-preview__listing">{conversation.listing.title}</span>
                        <span className="conversation-preview__message">
                          {conversation.lastMessage ?? 'Start the conversation'}
                        </span>
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="conversation-preview__badge" aria-label={`${conversation.unreadCount} unread messages`}>
                          {Math.min(conversation.unreadCount, 99)}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className="messages-thread" aria-label="Message thread">
          {invalidConversationId ? (
            <ErrorState
              compact
              title="That conversation does not exist"
              message="Choose a conversation from your inbox."
              action={<Link className="button button--secondary" to="/messages">Back to messages</Link>}
            />
          ) : !conversationId ? (
            <div className="messages-thread__empty">
              <EmptyState
                icon={conversations.length === 0 ? Inbox : MessageCircle}
                title={conversations.length === 0 ? 'Your inbox is ready' : 'Choose a conversation'}
                message={conversations.length === 0
                  ? 'Find something you need, then message its owner to arrange a pickup.'
                  : 'Select a message on the left to continue the conversation.'}
                action={conversations.length === 0 ? (
                  <Link className="button button--primary" to="/">
                    <Search size={18} aria-hidden="true" /> Browse items
                  </Link>
                ) : undefined}
              />
            </div>
          ) : !listLoading && !listError && !selectedConversation ? (
            <ErrorState
              compact
              title="Conversation not found"
              message="It may no longer be available. Choose another conversation from your inbox."
              action={<Link className="button button--secondary" to="/messages">Back to messages</Link>}
            />
          ) : selectedConversation ? (
            <>
              <header className="messages-thread__header">
                <Link className="icon-button messages-thread__back" to="/messages" aria-label="Back to conversations">
                  <ArrowLeft size={20} aria-hidden="true" />
                </Link>
                <Avatar name={selectedConversation.otherUser.name} src={selectedConversation.otherUser.avatarUrl} />
                <div className="messages-thread__identity">
                  <strong>{selectedConversation.otherUser.name}</strong>
                  <Link to={`/listings/${selectedConversation.listing.id}`}>
                    About {selectedConversation.listing.title}
                  </Link>
                </div>
                <Link className="messages-thread__listing-image" to={`/listings/${selectedConversation.listing.id}`}>
                  <img
                    src={selectedConversation.listing.photoUrl || DEFAULT_IMAGE}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_IMAGE
                    }}
                  />
                </Link>
              </header>

              <div className="message-history" aria-live="polite">
                {messagesError ? (
                  <ErrorState
                    compact
                    message={messagesError}
                    action={(
                      <button
                        className="button button--secondary button--small"
                        type="button"
                        onClick={() => setThreadReloadKey((key) => key + 1)}
                      >
                        Try again
                      </button>
                    )}
                  />
                ) : messagesLoading && thread.conversationId !== conversationId ? (
                  <LoadingState message="Loading messages…" />
                ) : visibleMessages.length === 0 ? (
                  <EmptyState
                    compact
                    icon={MessageCircle}
                    title="Start the conversation"
                    message={`Send ${selectedConversation.otherUser.name.split(' ')[0]} a message about the pickup.`}
                  />
                ) : (
                  <ol className="message-list">
                    {visibleMessages.map((message) => {
                      const mine = message.senderId === user?.id
                      return (
                        <li className={`message-row${mine ? ' message-row--mine' : ''}`} key={message.id}>
                          <div className="message-bubble">
                            <p>{message.body}</p>
                            <time dateTime={message.createdAt}>{formatRelativeDate(message.createdAt)}</time>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="message-composer" onSubmit={handleSend}>
                <label className="sr-only" htmlFor="message-body">Message</label>
                <input
                  id="message-body"
                  name="body"
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={2000}
                  placeholder={`Message ${selectedConversation.otherUser.name.split(' ')[0]}…`}
                  autoComplete="off"
                  disabled={sending}
                />
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={sending || draft.trim().length === 0}
                  aria-label="Send message"
                >
                  <Send size={18} aria-hidden="true" />
                  <span>{sending ? 'Sending…' : 'Send'}</span>
                </button>
              </form>
            </>
          ) : (
            <LoadingState message="Loading conversation…" />
          )}
        </section>
      </div>
    </main>
  )
}
