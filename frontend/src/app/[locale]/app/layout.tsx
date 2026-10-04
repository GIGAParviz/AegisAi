'use client'

import { WorkspaceShell } from '@/components/layout/WorkspaceShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>
}
