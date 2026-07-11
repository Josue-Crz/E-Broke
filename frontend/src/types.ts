export type Category =
  | 'dorm_essentials'
  | 'textbooks'
  | 'electronics'
  | 'furniture'
  | 'food'
  | 'other'

export type Condition = 'like_new' | 'good' | 'fair'
export type ListingStatus = 'active' | 'claimed' | 'removed'

export interface User {
  id: number
  name: string
  email: string
  avatarUrl: string | null
  verified: boolean
  createdAt: string
}

export interface Owner {
  id: number
  name: string
  avatarUrl: string | null
}

export interface Listing {
  id: number
  userId: number
  title: string
  description: string
  category: Category
  condition: Condition
  neighborhood: string | null
  photoUrls: string[]
  status: ListingStatus
  createdAt: string
  owner?: Owner
  savedAt?: string
  score?: number
}

export interface ListingInput {
  title: string
  description: string
  category: Category
  condition: Condition
  neighborhood?: string
  photoUrls: string[]
}

export interface PagedListings {
  listings: Listing[]
  page: number
  limit: number
  total: number
}

export interface WishlistAlert {
  id: number
  queryText: string
  createdAt: string
}

export interface Conversation {
  id: number
  listing: {
    id: number
    title: string
    photoUrl: string | null
    status: ListingStatus
  }
  otherUser: Owner
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
  createdAt: string
}

export interface Message {
  id: number
  conversationId: number
  senderId: number
  body: string
  readAt: string | null
  createdAt: string
}

export interface AppNotification {
  id: number
  type: 'wishlist_match' | 'listing_claimed' | string
  payload: {
    listingId?: number
    listingTitle?: string
    claimedBy?: { id: number; name: string }
    [key: string]: unknown
  }
  readAt: string | null
  createdAt: string
}

export interface PhotoAnalysis {
  title: string
  description: string
  category: string
  condition: string
  isFree: boolean
  flagged: boolean
  flagReason: string | null
}
