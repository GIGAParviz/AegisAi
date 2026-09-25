'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { apiPost, apiGet } from '@/lib/api'
import type { User, LoginRequest, RegisterRequest, TokenResponse } from '@/lib/types'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout: logoutStore } = useAuthStore()
  const router = useRouter()

  const login = useCallback(async (data: LoginRequest): Promise<User> => {
    const tokens = await apiPost<TokenResponse>('/auth/login', { json: data })
    const userRes = await apiGet<User>('/admin/whoami')
    setUser(userRes)
    return userRes
  }, [setUser])

  const register = useCallback(async (data: RegisterRequest): Promise<User> => {
    const userRes = await apiPost<User>('/auth/register', { json: data })
    const tokens = await apiPost<TokenResponse>('/auth/login', { json: data })
    setUser(userRes)
    return userRes
  }, [setUser])

  const logout = useCallback(() => {
    logoutStore()
    router.push('/en/login')
  }, [logoutStore, router])

  const fetchUser = useCallback(async () => {
    try {
      const userRes = await apiGet<User>('/admin/whoami')
      setUser(userRes)
    } catch {
      setUser(null)
    } finally {
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