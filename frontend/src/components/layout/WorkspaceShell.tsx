'use client'

import { clsx } from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

/**
 * The single workspace shell: auth guard + sidebar + header, rendered once
 * by app/[locale]/app/layout.tsx. Pages supply their own content; wide
 * pages wrap content in <PageBody/> for the centered padded frame, while
 * chat uses `data-frame="full"` styling via the ChatPage root.
 */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const locale = useLocale()
  const ta = useTranslations('auth')
  const { fetchUser, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    // isLoading starts true; fetchUser validates the persisted session
    // against the API (or clears a dead one).
    if (isLoading) fetchUser()
  }, [isLoading, fetchUser])

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
          <p className="font-mono text-xs uppercase tracking-[1.5px] text-faint">AegisAI</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="card-paper w-full max-w-sm p-8 text-center">
          <p className="display text-2xl">{ta('signInRequired')}</p>
          <p className="mt-2 text-sm text-muted">{ta('sessionEnded')}</p>
          <a
            href={`/${locale}/login`}
            className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
          >
            {ta('goToLogin')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
      />

      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-text/30 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div
        className={clsx(
          'flex min-w-0 flex-1 flex-col transition-[margin] duration-300',
          collapsed ? 'lg:ms-[72px]' : 'lg:ms-64',
        )}
      >
        <Header onMenu={() => setMobileOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  )
}

/** Centered, padded frame for normal pages. Chat skips it (full height). */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={clsx('mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10', className)}>
        {children}
      </div>
    </div>
  )
}
