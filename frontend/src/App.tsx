import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { SavedProvider } from './context/SavedContext'
import { ToastProvider } from './context/ToastContext'
import { MessagesPage } from './pages/MessagesPage'
import { BrowsePage } from './pages/BrowsePage'
import { ListingDetailPage } from './pages/ListingDetailPage'
import { ListingFormPage } from './pages/ListingFormPage'
import { LoginPage } from './pages/LoginPage'
import { MyListingsPage } from './pages/MyListingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { RegisterPage } from './pages/RegisterPage'
import { SavedPage } from './pages/SavedPage'
import { SearchPage } from './pages/SearchPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { WishlistPage } from './pages/WishlistPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <SavedProvider>
              <ScrollToTop />
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<BrowsePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="verify-email" element={<VerifyEmailPage />} />
                  <Route path="listings/:id" element={<ListingDetailPage />} />
                  <Route
                    path="listings/new"
                    element={<ProtectedRoute verified><ListingFormPage /></ProtectedRoute>}
                  />
                  <Route
                    path="listings/:id/edit"
                    element={<ProtectedRoute verified><ListingFormPage /></ProtectedRoute>}
                  />
                  <Route
                    path="me/listings"
                    element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>}
                  />
                  <Route
                    path="saved"
                    element={<ProtectedRoute><SavedPage /></ProtectedRoute>}
                  />
                  <Route
                    path="wishlist"
                    element={<ProtectedRoute><WishlistPage /></ProtectedRoute>}
                  />
                  <Route
                    path="notifications"
                    element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>}
                  />
                  <Route
                    path="messages"
                    element={<ProtectedRoute verified><MessagesPage /></ProtectedRoute>}
                  />
                  <Route
                    path="messages/:conversationId"
                    element={<ProtectedRoute verified><MessagesPage /></ProtectedRoute>}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </SavedProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
