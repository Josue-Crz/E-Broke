import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api } from '../lib/api'
import type { Listing } from '../types'
import { useAuth } from './AuthContext'

interface SavedContextValue {
  savedIds: Set<number>
  loading: boolean
  isSaved: (listingId: number) => boolean
  toggleSaved: (listingId: number) => Promise<boolean>
  refreshSaved: () => Promise<Listing[]>
}

const SavedContext = createContext<SavedContextValue | null>(null)

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  const refreshSaved = useCallback(async () => {
    if (!user) {
      setSavedIds(new Set())
      return []
    }
    setLoading(true)
    try {
      const result = await api<{ listings: Listing[] }>('/me/saved')
      setSavedIds(new Set(result.listings.map((listing) => listing.id)))
      return result.listings
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refreshSaved().catch(() => setSavedIds(new Set()))
  }, [refreshSaved])

  const toggleSaved = useCallback(
    async (listingId: number) => {
      const wasSaved = savedIds.has(listingId)
      setSavedIds((current) => {
        const next = new Set(current)
        if (wasSaved) next.delete(listingId)
        else next.add(listingId)
        return next
      })

      try {
        await api<{ ok: boolean }>(`/listings/${listingId}/save`, {
          method: wasSaved ? 'DELETE' : 'POST',
        })
        return !wasSaved
      } catch (error) {
        setSavedIds((current) => {
          const next = new Set(current)
          if (wasSaved) next.add(listingId)
          else next.delete(listingId)
          return next
        })
        throw error
      }
    },
    [savedIds],
  )

  const value = useMemo(
    () => ({
      savedIds,
      loading,
      isSaved: (listingId: number) => savedIds.has(listingId),
      toggleSaved,
      refreshSaved,
    }),
    [savedIds, loading, toggleSaved, refreshSaved],
  )

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
}

export function useSaved() {
  const value = useContext(SavedContext)
  if (!value) throw new Error('useSaved must be used inside SavedProvider')
  return value
}
