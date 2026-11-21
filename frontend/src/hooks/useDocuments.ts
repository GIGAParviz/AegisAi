'use client'
import { useEffect } from 'react'
import { create } from 'zustand'
import type { Document } from '@/lib/types'
import { apiGet, apiPost } from '@/lib/api'
import { errorMessage } from '@/lib/workspace-api'
import { useAuthStore } from '@/stores/authStore'
let libraryGeneration = 0
interface DocState {
  documents: Document[]; uploading: boolean; loading: boolean; error: string | null
  addDocument: (doc: Document) => void; patchDocument: (id: string, patch: Partial<Document>) => void
  removeDocument: (id: string) => void; setError: (error: string | null) => void; setUploading: (uploading: boolean) => void
}
export const useDocStore = create<DocState>((set) => ({
  documents: [], uploading: false, loading: true, error: null,
  addDocument: doc => set(s => ({ documents: [doc, ...s.documents.filter(d => d.id !== doc.id)] })),
  patchDocument: (id, patch) => set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, ...patch } : d) })),
  removeDocument: id => set(s => ({ documents: s.documents.filter(d => d.id !== id) })),
  setError: error => set({ error }), setUploading: uploading => set({ uploading }),
}))
export async function loadDocuments() {
  const generation = libraryGeneration
  useDocStore.setState({ loading: true, error: null })
  try { const documents = await apiGet<Document[]>('/documents'); if (generation === libraryGeneration) useDocStore.setState({ documents, loading: false }); return documents }
  catch (e) { const message = await errorMessage(e); if (generation === libraryGeneration) useDocStore.setState({ loading: false, error: message }); throw e }
}
export async function uploadDocument(file: File): Promise<Document> {
  const generation = libraryGeneration
  const formData = new FormData(); formData.append('file', file)
  const created = await apiPost<Document>('/documents', { body: formData })
  const doc = await apiGet<Document>(`/documents/${created.id}`)
  if (generation === libraryGeneration) useDocStore.getState().addDocument(doc); return doc
}
export async function refreshDocument(id: string): Promise<Document> {
  const generation = libraryGeneration
  const doc = await apiGet<Document>(`/documents/${id}`); if (generation === libraryGeneration) useDocStore.getState().patchDocument(id, doc); return doc
}
export async function refreshPending(): Promise<void> {
  const pending = useDocStore.getState().documents.filter(d => d.status === 'QUEUED' || d.status === 'PROCESSING')
  await Promise.all(pending.map(d => refreshDocument(d.id)))
}
export function useDocuments() {
  const state = useDocStore()
  const ownerId = useAuthStore(s => s.user?.id)
  useEffect(() => { void loadDocuments().catch(() => {}); return () => { libraryGeneration++; useDocStore.setState({ documents: [], error: null, loading: true }) } }, [ownerId])
  return state
}
