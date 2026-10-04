'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Document } from '@/lib/types'
import { apiGet, apiPost } from '@/lib/api'

interface DocState {
  /** Documents uploaded from this browser — the backend has no list
   *  endpoint yet, so we keep the library locally and hydrate status
   *  from GET /documents/{id}. */
  documents: Document[]
  uploading: boolean
  error: string | null
  addDocument: (doc: Document) => void
  patchDocument: (id: string, patch: Partial<Document>) => void
  removeDocument: (id: string) => void
  setError: (e: string | null) => void
  setUploading: (v: boolean) => void
}

export const useDocStore = create<DocState>()(
  persist(
    (set) => ({
      documents: [],
      uploading: false,
      error: null,
      addDocument: (doc) =>
        set((s) => ({ documents: [doc, ...s.documents.filter((d) => d.id !== doc.id)] })),
      patchDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
      setError: (error) => set({ error }),
      setUploading: (uploading) => set({ uploading }),
    }),
    {
      name: 'aegis-docs',
      partialize: (s) => ({ documents: s.documents }),
    },
  ),
)

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData()
  formData.append('file', file)
  const doc = await apiPost<Document>('/documents', { body: formData })
  useDocStore.getState().addDocument(doc)
  return doc
}

export async function refreshDocument(id: string): Promise<Document> {
  const doc = await apiGet<Document>(`/documents/${id}`)
  useDocStore.getState().patchDocument(id, doc)
  return doc
}

/** Poll every still-PROCESSING/QUEUED document to advance its status. */
export async function refreshPending(): Promise<void> {
  const { documents } = useDocStore.getState()
  await Promise.allSettled(
    documents
      .filter((d) => d.status === 'QUEUED' || d.status === 'PROCESSING')
      .map((d) => refreshDocument(d.id)),
  )
}

export function useDocuments() {
  return useDocStore()
}
