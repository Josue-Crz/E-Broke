import { describe, expect, it } from 'vitest'
import { initials } from './format'

describe('initials', () => {
  it('uses at most two words', () => {
    expect(initials('Priya Shah')).toBe('PS')
    expect(initials('Alice')).toBe('A')
    expect(initials('  Marcus   Chen  Jr ')).toBe('MC')
  })
})
