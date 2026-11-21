import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import NodeInspector from './NodeInspector'

it('offers only registered tools and resets arguments when changing tool', () => {
  const onChange = vi.fn(), onJsonError = vi.fn()
  render(<NextIntlClientProvider locale="en" messages={messages}><NodeInspector node={{ id: 'tool', type: 'tool', position: { x: 0, y: 0 }, config: { name: 'search_docs', arguments: { query: '{{input}}', limit: 5 } } }} agents={[]} onChange={onChange} onDelete={vi.fn()} onJsonError={onJsonError} /></NextIntlClientProvider>)
  expect(screen.getByTestId('config-name').tagName).toBe('SELECT')
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['search_docs', 'get_document'])
  fireEvent.change(screen.getByTestId('config-arguments'), { target: { value: '{broken' } })
  expect(onJsonError).toHaveBeenLastCalledWith(true)
  fireEvent.change(screen.getByTestId('config-name'), { target: { value: 'get_document' } })
  expect(onChange).toHaveBeenLastCalledWith({ name: 'get_document', arguments: { document_id: '{{input}}' } })
  expect(onJsonError).toHaveBeenLastCalledWith(false)
  expect(screen.getByTestId('config-arguments')).toHaveValue(JSON.stringify({ document_id: '{{input}}' }, null, 2))
})

it('uses the backend retrieval limit', () => {
  render(<NextIntlClientProvider locale="en" messages={messages}><NodeInspector node={{ id: 'r', type: 'retrieve', position: { x: 0, y: 0 }, config: { query: '{{input}}', limit: 5 } }} agents={[]} onChange={vi.fn()} onDelete={vi.fn()} onJsonError={vi.fn()} /></NextIntlClientProvider>)
  expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '20')
})
