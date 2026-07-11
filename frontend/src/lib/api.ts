const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const isFormData = options.body instanceof FormData
  let requestBody: BodyInit | undefined

  if (options.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.body instanceof FormData) requestBody = options.body
  else if (options.body !== undefined) requestBody = JSON.stringify(options.body)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body: requestBody,
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'We could not reach e-Broke. Check your connection and try again.',
    )
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const shaped = data as
      | { error?: { code?: string; message?: string } | string; message?: string }
      | null
    const legacyMessage = typeof shaped?.error === 'string' ? shaped.error : undefined
    const detail = typeof shaped?.error === 'object' ? shaped.error : undefined
    // A 401 anywhere means the session is gone — let AuthContext reset the
    // user so the UI can't sit in a zombie logged-in state.
    if (response.status === 401) {
      window.dispatchEvent(new Event('ebroke:unauthenticated'))
    }
    throw new ApiError(
      response.status,
      detail?.code ?? `HTTP_${response.status}`,
      detail?.message ?? legacyMessage ?? shaped?.message ?? 'Something went wrong. Please try again.',
    )
  }

  return data as T
}

export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something unexpected happened. Please try again.'
  }

  switch (error.code) {
    case 'AI_UNAVAILABLE':
    case 'HTTP_502':
      return 'Our AI helper is taking a breather. Please try again in a moment.'
    case 'RATE_LIMITED':
    case 'HTTP_429':
      return 'You have made a few quick requests. Give it a moment, then try again.'
    case 'ALREADY_CLAIMED':
      return 'Someone else just claimed this item.'
    case 'NETWORK_ERROR':
      return error.message
    default:
      return error.message
  }
}

export function authRedirectFor(error: unknown): '/login' | '/verify-email' | null {
  if (!(error instanceof ApiError)) return null
  if (error.status === 401 || error.code === 'UNAUTHENTICATED') return '/login'
  if (error.status === 403 && error.code === 'EMAIL_NOT_VERIFIED') return '/verify-email'
  return null
}
