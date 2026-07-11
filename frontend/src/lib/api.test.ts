import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, authRedirectFor, friendlyError } from './api'

describe('api client', () => {
  afterEach(() => vi.restoreAllMocks())

  it('always sends session credentials and JSON content type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await api('/example', { method: 'POST', body: { hello: 'gator' } })

    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/example$/)
    expect(fetchSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        credentials: 'include',
        body: JSON.stringify({ hello: 'gator' }),
      }),
    )
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('normalizes the backend error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'ALREADY_CLAIMED', message: 'Taken' } }),
        { status: 409 },
      ),
    )

    await expect(api('/listings/1/claim', { method: 'POST' })).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_CLAIMED',
      message: 'Taken',
    })
  })

  it('normalizes the analyzer legacy string error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Vision model request failed' }), { status: 502 }),
    )

    const error = await api('/listings/analyze-photo').catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(friendlyError(error)).toContain('AI helper')
  })

  it('routes authentication errors to the right flow', () => {
    expect(authRedirectFor(new ApiError(401, 'UNAUTHENTICATED', 'Log in'))).toBe('/login')
    expect(authRedirectFor(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify'))).toBe('/verify-email')
    expect(authRedirectFor(new ApiError(422, 'FREE_ONLY_VIOLATION', 'No sales'))).toBeNull()
  })
})
