'use client'

import { clsx } from 'clsx'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-faint text-white',
    success: 'bg-[#68734b] text-white',
    warning: 'bg-[#c9a84c] text-white',
    danger: 'bg-warm text-white',
    info: 'bg-[#4c767c] text-white',
    neutral: 'bg-panel text-text border border-line',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}