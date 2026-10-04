import ky, { type KyInstance, type Options } from 'ky'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

let authToken: string | null = null
let refreshToken: string | null = null

export function setAuthTokens(access: string, refresh: string) {
  authToken = access
  refreshToken = refresh
  if (typeof window !== 'undefined') {
    document.cookie = `access_token=${access}; path=/; max-age=1800; SameSite=Lax`
    document.cookie = `refresh_token=${refresh}; path=/; max-age=604800; SameSite=Lax`
  }
}

export function clearAuthTokens() {
  authToken = null
  refreshToken = null
  if (typeof window !== 'undefined') {
    document.cookie = 'access_token=; path=/; max-age=0'
    document.cookie = 'refresh_token=; path=/; max-age=0'
  }
}

function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function getAuthToken(): string | null {
  if (authToken) return authToken
  return getCookie('access_token')
}

function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken
  return getCookie('refresh_token')
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

/** Decode the `sub` (user id) claim from a JWT without verifying it —
 *  client-side display only, never for authz decisions. */
export function decodeTokenSub(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.sub === 'string' ? json.sub : null
  } catch {
    return null
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false

  try {
    const response = await ky.post(`${BACKEND_URL}/auth/refresh`, {
      json: { refresh_token: refresh },
      timeout: 10000,
    })
    const data = await response.json<TokenResponse>()
    setAuthTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

function createApiClient(): KyInstance {
  return ky.create({
    prefix: BACKEND_URL,
    timeout: 30000,
    hooks: {
      beforeRequest: [
        ({ request }) => {
          const token = getAuthToken()
          if (token) request.headers.set('Authorization', `Bearer ${token}`)
        },
      ],
      afterResponse: [
        async ({ request, options, response }) => {
          if (response.status === 401) {
            const refreshed = await refreshAccessToken()
            if (refreshed) {
              const token = getAuthToken()
              if (token) {
                request.headers.set('Authorization', `Bearer ${token}`)
                return ky(request, options as Options)
              }
            } else {
              clearAuthTokens()
              if (
                typeof window !== 'undefined' &&
                !window.location.pathname.endsWith('/login')
              ) {
                const locale = window.location.pathname.split('/')[1] === 'fa' ? 'fa' : 'en'
                // Hard redirect outside the React tree (inside a ky hook).
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = `/${locale}/login`
              }
            }
          }
          return response
        },
      ],
    },
  })
}

export const api = createApiClient()

/** Login and persist tokens. Returns the raw token payload. */
export async function loginAndStore(email: string, password: string): Promise<TokenResponse> {
  const tokens = await ky
    .post(`${BACKEND_URL}/auth/login`, { json: { email, password }, timeout: 15000 })
    .json<TokenResponse>()
  setAuthTokens(tokens.access_token, tokens.refresh_token)
  return tokens
}

/** Register, then auto-login so tokens are stored too. */
export async function registerAndLogin(email: string, password: string): Promise<TokenResponse> {
  await ky.post(`${BACKEND_URL}/auth/register`, { json: { email, password }, timeout: 15000 })
  return loginAndStore(email, password)
}

export async function apiGet<T>(path: string, options?: Options): Promise<T> {
  return api.get(path, options).json<T>()
}

export async function apiPost<T>(path: string, options?: Options): Promise<T> {
  return api.post(path, options).json<T>()
}

export async function apiPut<T>(path: string, options?: Options): Promise<T> {
  return api.put(path, options).json<T>()
}

export async function apiDelete<T>(path: string, options?: Options): Promise<T> {
  return api.delete(path, options).json<T>()
}

export async function apiStream(path: string, options?: Options): Promise<Response> {
  return api.post(path, {
    ...options,
    headers: {
      ...options?.headers,
      Accept: 'text/event-stream',
    },
  })
}
