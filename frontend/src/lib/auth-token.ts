// Tiny browser-side token reader shared between hooks (no SSR).
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  const parts = `; ${document.cookie}`.split('; access_token=')
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null
  return null
}
