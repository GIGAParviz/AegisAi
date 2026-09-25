'use client'

import { forwardRef, type LabelHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={clsx('block text-sm font-medium text-text mb-1', className)}
        {...props}
      >
        {children}
        {required && <span className="text-warm ml-1" aria-hidden="true">*</span>}
      </label>
    )
  }
)

Label.displayName = 'Label'