'use client'

import { useState, useCallback, useEffect } from 'react'
import { apiGet, apiPost, apiStream } from '@/lib/api'
import type { Document, DocumentChunk } from '@/lib/types'

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Document[]>('/documents')
      setDocuments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadDocument = useCallback(async (file: File): Promise<Document> => {
    const formData = new FormData()
    formData.append('file', file)
    const doc = await apiPost<Document>('/documents', { body: formData })
    setDocuments((prev) => [doc, ...prev])
    return doc
  }, [])

  const fetchDocument = useCallback(async (id: string): Promise<Document> => {
    return apiGet<Document>(`/documents/${id}`)
  }, [])

  const fetchChunks = useCallback(async (documentId: string): Promise<DocumentChunk[]> => {
    return apiGet<DocumentChunk[]>(`/documents/${documentId}/chunks`)
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    uploadDocument,
    fetchDocument,
    fetchChunks,
  }
}