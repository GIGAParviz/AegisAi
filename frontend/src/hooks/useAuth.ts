'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { apiGet, decodeTokenSub, loginAndStore, registerAndLogin, clearAuthTokens } from '@/lib/api'
import type { User } from '@/lib/types'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout: logoutStore } =
    useAuthStore()
  const router = useRouter()

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const tokens = await loginAndStore(email, password)
      // Try the admin endpoint for the authoritative role; regular users get
      // 403 there, which is expected — fall back to the USER role.
      let built: User = {
        id: decodeTokenSub(tokens.access_token) ?? crypto.randomUUID(),
        email,
        role: 'USER',
        is_active: true,
      }
      try {
        const me = await apiGet<Pick<User, 'id' | 'email' | 'role'>>('/admin/whoami')
        built = { ...built, ...me, is_active: true }
      } catch {
        // not an admin — keep USER fallback
      }
      setUser(built)
      return built
    },
    [setUser],
  )

  const register = useCallback(
    async (email: string, password: string): Promise<User> => {
      const tokens = await registerAndLogin(email, password)
      const built: User = {
        id: decodeTokenSub(tokens.access_token) ?? crypto.randomUUID(),
        email,
        role: 'USER',
        is_active: true,
      }
      setUser(built)
      return built
    },
    [setUser],
  )

  const logout = useCallback(() => {
    clearAuthTokens()
    logoutStore()
    const locale = window.location.pathname.startsWith('/fa') ? 'fa' : 'en'
    router.push(`/${locale}/login`)
  }, [logoutStore, router])

  const fetchUser = useCallback(async () => {
    try {
      const me = await apiGet<User>('/admin/whoami')
      setUser(me)
    } catch (err) {
      // A 403 means "valid session, not admin" — keep the persisted user.
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 403) {
        // 401s are handled by the refresh interceptor; anything else: stay
        // logged out only if we truly have no session.
        const { isAuthenticated } = useAuthStore.getState()
        if (!isAuthenticated) setUser(null)
      }
      setLoading(false)
    }
  }, [setUser, setLoading])

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    fetchUser,
  }
}
