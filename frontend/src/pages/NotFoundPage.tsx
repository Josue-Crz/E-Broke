import { Home, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/StatePanel'

export function NotFoundPage() {
  return (
    <main className="page-shell page-shell--narrow not-found-page">
      <EmptyState
        icon={SearchX}
        title="This page wandered off"
        message="The link may be out of date, but there are plenty of free finds waiting back home."
        action={(
          <Link className="button button--primary" to="/">
            <Home size={18} aria-hidden="true" /> Browse free items
          </Link>
        )}
      />
    </main>
  )
}
