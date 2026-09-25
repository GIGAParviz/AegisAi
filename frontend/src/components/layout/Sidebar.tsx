'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  FileText,
  Search,
  MessageSquare,
  ClipboardCheck,
  FileCheck,
  Activity,
  BarChart,
  Settings,
  Users,
  Server,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'USER', 'AGENT'] },
  { name: 'Documents', href: '/documents', icon: FileText, roles: ['ADMIN', 'USER', 'AGENT'] },
  { name: 'Search', href: '/search', icon: Search, roles: ['ADMIN', 'USER', 'AGENT'] },
  { name: 'Chat', href: '/chat', icon: MessageSquare, roles: ['ADMIN', 'USER', 'AGENT'] },
  { name: 'Approvals', href: '/approvals', icon: ClipboardCheck, roles: ['ADMIN'] },
  { name: 'Audit Log', href: '/audit', icon: FileCheck, roles: ['ADMIN'] },
  { name: 'Traces', href: '/traces', icon: Activity, roles: ['ADMIN'] },
  { name: 'Evals', href: '/evals', icon: BarChart, roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'USER', 'AGENT'] },
  { name: 'Admin', href: '/admin', icon: Users, roles: ['ADMIN'] },
  { name: 'System', href: '/system', icon: Server, roles: ['ADMIN'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  const filteredNav = navigation.filter((item) => 
    user && item.roles.includes(user.role)
  )

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 h-screen bg-panel border-r border-line transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Main navigation"
    >
      <div className="flex flex-col h-full">
        <div className={clsx('flex items-center justify-between h-16 px-4 border-b border-line', collapsed && 'justify-center')}>
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2" aria-label="AegisAI Dashboard">
              <span className="text-2xl font-serif text-text italic">AegisAI</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={clsx(
              'p-1.5 rounded hover:bg-line transition-colors text-muted hover:text-text',
              collapsed && 'mx-auto'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1" aria-label="Navigation">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-muted hover:bg-line hover:text-text',
                  collapsed && 'justify-center'
                )}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-line">
          <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{user?.email}</p>
                <p className="text-xs text-muted capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

import { useState } from 'react'