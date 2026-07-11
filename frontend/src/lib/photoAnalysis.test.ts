import { describe, expect, it } from 'vitest'
import { mapPhotoCategory, mapPhotoCondition } from './photoAnalysis'

describe('photo suggestion enum mapping', () => {
  it('maps analyzer categories to database categories', () => {
    expect(mapPhotoCategory('books')).toBe('textbooks')
    expect(mapPhotoCategory('appliances')).toBe('dorm_essentials')
    expect(mapPhotoCategory('clothing')).toBe('other')
    expect(mapPhotoCategory('furniture')).toBe('furniture')
  })

  it('maps analyzer conditions to database conditions', () => {
    expect(mapPhotoCondition('like-new')).toBe('like_new')
    expect(mapPhotoCondition('worn')).toBe('fair')
    expect(mapPhotoCondition('good')).toBe('good')
  })

  it('requires confirmation for unknown values', () => {
    expect(mapPhotoCategory('collectibles')).toBeNull()
    expect(mapPhotoCondition('mint')).toBeNull()
  })
})
