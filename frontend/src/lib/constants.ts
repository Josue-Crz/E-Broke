import type { Category, Condition } from '../types'

export const categories: Array<{ value: Category; label: string; emoji: string }> = [
  { value: 'dorm_essentials', label: 'Dorm essentials', emoji: '🪴' },
  { value: 'textbooks', label: 'Textbooks', emoji: '📚' },
  { value: 'electronics', label: 'Electronics', emoji: '🎧' },
  { value: 'furniture', label: 'Furniture', emoji: '🪑' },
  { value: 'food', label: 'Food', emoji: '🍜' },
  { value: 'other', label: 'Other', emoji: '✨' },
]

export const conditions: Array<{ value: Condition; label: string }> = [
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
]

export const categoryLabel = (value: Category) =>
  categories.find((category) => category.value === value)?.label ?? value

export const categoryEmoji = (value: Category) =>
  categories.find((category) => category.value === value)?.emoji ?? '✨'

export const conditionLabel = (value: Condition) =>
  conditions.find((condition) => condition.value === value)?.label ?? value

export const DEFAULT_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22 viewBox=%220 0 600 400%22%3E%3Crect width=%22600%22 height=%22400%22 fill=%22%23e7eadf%22/%3E%3Ccircle cx=%22300%22 cy=%22170%22 r=%2270%22 fill=%22%23d3ff6d%22/%3E%3Cpath d=%22M270 148h60v60h-60z%22 fill=%22none%22 stroke=%22%2318211d%22 stroke-width=%2212%22/%3E%3Cpath d=%22M245 235h110%22 stroke=%22%2318211d%22 stroke-width=%2212%22 stroke-linecap=%22round%22/%3E%3Ctext x=%22300%22 y=%22305%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2224%22 fill=%22%235c655f%22%3EFree finds live here%3C/text%3E%3C/svg%3E'
