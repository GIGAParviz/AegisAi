// Shared navigation model — sidebar and shell highlight off these keys.
// `status`: 'live' pages hit real endpoints; 'soon' pages are honest stubs.
export type NavStatus = 'live' | 'soon'

export interface NavItem {
  key: string // message key under `nav.*`
  href: string // workspace-relative, e.g. '/app/dashboard'
  icon: string // icon name resolved in the Sidebar
  status: NavStatus
  adminOnly?: boolean
}

export interface NavGroup {
  key: string // message key under `nav.*` for the group label
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    key: 'workspace',
    items: [
      { key: 'dashboard', href: '/app/dashboard', icon: 'LayoutDashboard', status: 'live' },
      { key: 'documents', href: '/app/documents', icon: 'FileText', status: 'live' },
      { key: 'chat', href: '/app/chat', icon: 'MessageSquare', status: 'live' },
    ],
  },
  {
    key: 'knowledge',
    items: [{ key: 'search', href: '/app/search', icon: 'Search', status: 'soon' }],
  },
  {
    key: 'governance',
    items: [
      { key: 'approvals', href: '/app/approvals', icon: 'ClipboardCheck', status: 'soon' },
      { key: 'audit', href: '/app/audit', icon: 'FileCheck', status: 'soon' },
    ],
  },
  {
    key: 'insight',
    items: [
      { key: 'traces', href: '/app/traces', icon: 'Activity', status: 'soon' },
      { key: 'evals', href: '/app/evals', icon: 'FlaskConical', status: 'soon' },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'system', href: '/app/system', icon: 'Server', status: 'live' },
      { key: 'settings', href: '/app/settings', icon: 'Settings', status: 'soon' },
      { key: 'admin', href: '/app/admin', icon: 'Users', status: 'soon', adminOnly: true },
    ],
  },
]

/** Maps a workspace path to the `coming.subtitle*` message key. */
export const comingCopy: Record<string, string> = {
  '/app/search': 'subtitleSearch',
  '/app/approvals': 'subtitleApprovals',
  '/app/audit': 'subtitleAudit',
  '/app/traces': 'subtitleTraces',
  '/app/evals': 'subtitleEvals',
  '/app/settings': 'subtitleSettings',
  '/app/admin': 'subtitleAdmin',
}

/** Maps a workspace path to its roadmap phase label. */
export const comingPhase: Record<string, string> = {
  '/app/search': 'Phase 2 · T2.5',
  '/app/approvals': 'Phase 5 · T5.3',
  '/app/audit': 'Phase 4 · T4.3',
  '/app/traces': 'Phase 6 · T6.1',
  '/app/evals': 'Phase 6 · T6.2',
  '/app/settings': 'Phase 0 · T0.3',
  '/app/admin': 'Phase 1 · T1.4',
}
