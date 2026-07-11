import {
  Bell,
  Bookmark,
  ChevronDown,
  HeartHandshake,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { Avatar } from './Avatar'

export function Layout() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    let stopped = false
    const loadUnread = () => {
      if (document.hidden) return
      api<{ unreadCount: number }>('/me/unread-count')
        .then((result) => {
          if (!stopped) setUnreadCount(result.unreadCount)
        })
        .catch(() => undefined)
    }

    loadUnread()
    const timer = window.setInterval(loadUnread, 8000)
    const onVisible = () => loadUnread()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('ebroke:messages-read', loadUnread)

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('ebroke:messages-read', loadUnread)
    }
  }, [user])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  async function handleLogout() {
    // Leave protected routes before clearing auth so their guards cannot race
    // this navigation and send the user back to the login screen.
    navigate('/', { replace: true })
    await logout()
    setAccountOpen(false)
    showToast('You are logged out.', 'info')
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" to="/" onClick={closeMobile}>
            <span className="brand__mark" aria-hidden="true"><HeartHandshake size={22} /></span>
            <span>e-Broke</span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            <NavLink to="/" end><Home size={17} /> Browse</NavLink>
            <NavLink to="/search"><Search size={17} /> Search</NavLink>
            {user && (
              <NavLink to="/messages">
                <MessageCircle size={17} /> Messages
                {unreadCount > 0 && <span className="nav-badge">{Math.min(unreadCount, 99)}</span>}
              </NavLink>
            )}
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                <Link className="button button--primary button--small desktop-post" to="/listings/new">
                  <Plus size={17} /> Post an item
                </Link>
                <div className="account-menu" ref={accountRef}>
                  <button
                    className="account-trigger"
                    type="button"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    onClick={() => setAccountOpen((open) => !open)}
                  >
                    <Avatar name={user.name} src={user.avatarUrl} size="small" />
                    <span className="account-trigger__name">{user.name.split(' ')[0]}</span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                  {accountOpen && (
                    <div className="account-dropdown" role="menu">
                      <div className="account-dropdown__identity">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                        <span className={`verification-chip${user.verified ? ' verification-chip--verified' : ''}`}>
                          {user.verified ? 'Verified Gator' : 'Verification needed'}
                        </span>
                      </div>
                      <Link role="menuitem" to="/me/listings" onClick={() => setAccountOpen(false)}><UserRound size={17} /> My listings</Link>
                      <Link role="menuitem" to="/saved" onClick={() => setAccountOpen(false)}><Bookmark size={17} /> Saved items</Link>
                      <Link role="menuitem" to="/wishlist" onClick={() => setAccountOpen(false)}><Sparkles size={17} /> Wish alerts</Link>
                      <Link role="menuitem" to="/notifications" onClick={() => setAccountOpen(false)}><Bell size={17} /> Notifications</Link>
                      <button role="menuitem" type="button" onClick={handleLogout}><LogOut size={17} /> Log out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link className="header-login" to="/login">Log in</Link>
                <Link className="button button--primary button--small header-signup" to="/register">Join e-Broke</Link>
              </>
            )}
            <button
              className="mobile-menu-button"
              type="button"
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            <NavLink to="/" end onClick={closeMobile}><Home size={19} /> Browse</NavLink>
            <NavLink to="/search" onClick={closeMobile}><Search size={19} /> Search</NavLink>
            {user ? (
              <>
                <NavLink to="/listings/new" onClick={closeMobile}><Plus size={19} /> Post an item</NavLink>
                <NavLink to="/messages" onClick={closeMobile}>
                  <MessageCircle size={19} /> Messages
                  {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
                </NavLink>
                <NavLink to="/saved" onClick={closeMobile}><Bookmark size={19} /> Saved</NavLink>
                <NavLink to="/notifications" onClick={closeMobile}><Bell size={19} /> Notifications</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/login" onClick={closeMobile}><UserRound size={19} /> Log in</NavLink>
                <NavLink to="/register" onClick={closeMobile}><Plus size={19} /> Join e-Broke</NavLink>
              </>
            )}
          </nav>
        )}
      </header>

      <div id="main-content"><Outlet /></div>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <Link className="brand brand--footer" to="/">
              <span className="brand__mark" aria-hidden="true"><HeartHandshake size={20} /></span>
              <span>e-Broke</span>
            </Link>
            <p>Good stuff. Zero dollars. Just Gators helping Gators.</p>
          </div>
          <div className="site-footer__note">
            <span>Built for SFSU</span>
            <span aria-hidden="true">•</span>
            <span>Free-only, always</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
