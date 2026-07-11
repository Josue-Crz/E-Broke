import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

interface StatePanelProps {
  title?: string
  message?: string
  action?: ReactNode
  icon?: LucideIcon
  compact?: boolean
}

export function LoadingState({ message = 'Loading the good stuff…' }: { message?: string }) {
  return (
    <div className="state-panel state-panel--compact" role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}

export function EmptyState({
  title = 'Nothing here yet',
  message,
  action,
  icon: Icon = Inbox,
  compact,
}: StatePanelProps) {
  return (
    <div className={`state-panel${compact ? ' state-panel--compact' : ''}`}>
      <span className="state-panel__icon"><Icon aria-hidden="true" /></span>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'That did not work',
  message = 'Please try again.',
  action,
  compact,
}: StatePanelProps) {
  return (
    <div className={`state-panel state-panel--error${compact ? ' state-panel--compact' : ''}`} role="alert">
      <span className="state-panel__icon"><AlertCircle aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  )
}
