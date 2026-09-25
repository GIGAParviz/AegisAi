'use client'

import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { LogOut, User, Menu } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { LocaleSwitcher } from './LocaleSwitcher'

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/en/login')
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-panel/80 backdrop-blur-sm border-b border-line">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="lg:hidden p-2 rounded hover:bg-line transition-colors text-muted hover:text-text" aria-label="Toggle menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block w-px h-6 bg-line" />
          <span className="text-sm font-mono text-faint uppercase tracking-wider">
            {pathname.split('/').filter(Boolean).pop() || 'Dashboard'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          
          {user && (
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-text">{user.email}</p>
                <p className="text-xs text-muted capitalize">{user.role.toLowerCase()}</p>
              </div>
              <div className="w-px h-6 bg-line mx-2" />
              <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Log out">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}