'use client'

import { clsx } from 'clsx'
import { forwardRef, type TableHTMLAttributes } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface TableProps<T> extends TableHTMLAttributes<HTMLTableElement> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  rowClassName?: (row: T) => string
  emptyMessage?: string
  className?: string
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  rowClassName,
  emptyMessage = 'No data available',
  className,
  children,
  ...props
}: TableProps<T>) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-sm" {...props}>
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                className={clsx(
                  'px-4 py-3 text-left font-mono text-xs uppercase tracking-wider text-faint',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className={clsx('hover:bg-[rgb(238,237,220)] transition-colors', rowClassName?.(row))}
              >
                {columns.map((column) => (
                  <td key={column.key} className={clsx('px-4 py-3', column.className)}>
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {children}
    </div>
  )
}