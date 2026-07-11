import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingState } from './StatePanel'

export function ProtectedRoute({ children, verified = false }: { children: React.ReactNode; verified?: boolean }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className="page-shell"><LoadingState /></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (verified && !user.verified) {
    return <Navigate to="/verify-email" replace state={{ from: location.pathname, email: user.email }} />
  }
  return children
}
