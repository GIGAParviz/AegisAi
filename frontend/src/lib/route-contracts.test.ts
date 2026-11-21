import { expect, it, vi } from 'vitest'
import { redirect } from 'next/navigation'
import DocumentsPage from '@/app/[locale]/app/documents/page'
import DocumentPage from '@/app/[locale]/app/documents/[id]/page'
import en from '@/messages/en.json'
import fa from '@/messages/fa.json'
import { navGroups } from './nav-model'
vi.mock('next/navigation', () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }) }))
it.each(['en', 'fa'])('redirects legacy document routes into localized unified chat (%s)', async locale => {
  await expect(DocumentsPage({ params: Promise.resolve({ locale }) })).rejects.toThrow(`REDIRECT:/${locale}/app/chat`)
  await expect(DocumentPage({ params: Promise.resolve({ locale, id: 'doc id' }) })).rejects.toThrow(`REDIRECT:/${locale}/app/chat?doc=doc%20id`)
  expect(redirect).toHaveBeenCalledWith(`/${locale}/app/chat?doc=doc%20id`)
})
it('keeps English and Persian message keys in sync', () => {
  function keys(object: object, prefix = ''): string[] {
    return Object.entries(object).flatMap(([key, value]) => typeof value === 'object' && value !== null ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]).sort()
  }
  expect(keys(fa)).toEqual(keys(en))
})
it('exposes live agents, workflows and runs without a separate document destination', () => {
  const items = navGroups.flatMap(group => group.items)
  for (const key of ['agents', 'workflows', 'runs', 'approvals']) expect(items.find(item => item.key === key)?.status).toBe('live')
  expect(items.some(item => item.href === '/app/documents')).toBe(false)
})
