import type { Category, Condition } from '../types'

const categoryMap: Record<string, Category | null> = {
  furniture: 'furniture',
  electronics: 'electronics',
  books: 'textbooks',
  other: 'other',
  appliances: 'dorm_essentials',
  kitchen: 'dorm_essentials',
  decor: 'dorm_essentials',
  clothing: 'other',
}

const conditionMap: Record<string, Condition | null> = {
  'like-new': 'like_new',
  like_new: 'like_new',
  good: 'good',
  fair: 'fair',
  worn: 'fair',
}

export const mapPhotoCategory = (category: string): Category | null =>
  categoryMap[category.toLowerCase()] ?? null

export const mapPhotoCondition = (condition: string): Condition | null =>
  conditionMap[condition.toLowerCase()] ?? null
