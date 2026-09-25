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
        (request) => {
          const token = getAuthToken()
          if (token) {
            // @ts-expect-error - ky types mismatch
            request.headers.set('Authorization', `Bearer ${token}`)
          }
        },
      ],
      afterResponse: [
        // @ts-expect-error - ky types mismatch
        async (request, _options, response) => {
          if (response.status === 401) {
            const refreshed = await refreshAccessToken()
            if (refreshed) {
              const token = getAuthToken()
              if (token) {
                request.headers.set('Authorization', `Bearer ${token}`)
                return ky(request, _options)
              }
            } else {
              clearAuthTokens()
              if (typeof window !== 'undefined') {
                window.location.href = '/en/login'
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

export async function apiGet<T>(path: string, options?: Options): Promise<T> {
  return api.get(path, options).json()
}

export async function apiPost<T>(path: string, options?: Options): Promise<T> {
  return api.post(path, options).json()
}

export async function apiPut<T>(path: string, options?: Options): Promise<T> {
  return api.put(path, options).json()
}

export async function apiDelete<T>(path: string, options?: Options): Promise<T> {
  return api.delete(path, options).json()
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