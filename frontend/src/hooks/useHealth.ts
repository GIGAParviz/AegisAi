'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/lib/api'
import type { HealthResponse } from '@/lib/types'

/** Polls GET /health every `intervalMs`. setState happens only in promise
 *  callbacks / timers — never synchronously on mount. */
export function useHealth(intervalMs = 30000) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(() => {
    return apiGet<HealthResponse>('/health')
      .then((h) => {
        if (alive.current) setHealth(h)
        return h
      })
      .catch(() => {
        if (alive.current) setHealth(null)
        return null
      })
      .finally(() => {
        if (alive.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id)
  }, [load, intervalMs])

  return { health, loading, refresh: load }
}
