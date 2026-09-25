'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { FileText, Activity, Server, Database, Clock, TrendingUp } from 'lucide-react'
import { useDocuments } from '@/hooks/useDocuments'
import { apiGet } from '@/lib/api'
import type { HealthResponse } from '@/lib/types'

export default function DashboardPage() {
  const { documents, loading: docsLoading } = useDocuments()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await apiGet<HealthResponse>('/health')
        setHealth(data)
      } catch {
        setHealth(null)
      } finally {
        setHealthLoading(false)
      }
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const stats = [
    {
      name: 'Total Documents',
      value: documents.length,
      icon: FileText,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      name: 'Ready',
      value: documents.filter((d) => d.status === 'READY').length,
      icon: CheckCircle,
      color: 'text-[#68734b]',
      bg: 'bg-[#68734b]/10',
    },
    {
      name: 'Processing',
      value: documents.filter((d) => d.status === 'PROCESSING').length,
      icon: Activity,
      color: 'text-[#c9a84c]',
      bg: 'bg-[#c9a84c]/10',
    },
    {
      name: 'Failed',
      value: documents.filter((d) => d.status === 'FAILED').length,
      icon: AlertCircle,
      color: 'text-warm',
      bg: 'bg-warm/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker">Dashboard</p>
          <h1>Overview</h1>
        </div>
        <Link href="/en/documents">
          <Button>
            <FileText className="h-4 w-4" />
            Upload Document
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.name} padding="md">
            <CardContent className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-serif text-text">{stat.value}</p>
                <p className="text-sm text-muted">{stat.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card padding="md">
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-panel animate-pulse rounded" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <FileText className="h-12 w-12 mx-auto mb-4 text-faint" />
                <p>No documents yet</p>
                <Link href="/en/documents" className="text-accent hover:underline mt-2 inline-block">
                  Upload your first document →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.slice(0, 5).map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/en/documents/${doc.id}`}
                    className="flex items-center justify-between p-3 hover:bg-panel rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted" />
                      <div>
                        <p className="font-medium text-text truncate max-w-[200px]">{doc.filename}</p>
                        <p className="text-xs text-muted">{new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge variant={
                      doc.status === 'READY' ? 'success' :
                      doc.status === 'PROCESSING' ? 'warning' :
                      doc.status === 'FAILED' ? 'danger' : 'neutral'
                    }>
                      {doc.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-panel animate-pulse rounded" />
                ))}
              </div>
            ) : health ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className={`h-5 w-5 ${health.status === 'healthy' ? 'text-[#68734b]' : 'text-warm'}`} />
                    <span className="font-medium">API Status</span>
                  </div>
                  <Badge variant={health.status === 'healthy' ? 'success' : 'danger'}>
                    {health.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-panel rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">CPU Usage</p>
                    <p className="text-2xl font-serif text-text">{health.system['CPU Percent'].toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-panel rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">Memory</p>
                    <p className="text-2xl font-serif text-text">{health.system['Memory Percent'].toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-panel rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">Uptime</p>
                    <p className="text-lg font-serif text-text">
                      {Math.floor(health.system.UpTime / 3600)}h {Math.floor((health.system.UpTime % 3600) / 60)}m
                    </p>
                  </div>
                  <div className="p-3 bg-panel rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">Trace ID</p>
                    <p className="font-mono text-xs text-muted truncate max-w-[150px]">—</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted">
                <Activity className="h-12 w-12 mx-auto mb-4 text-faint" />
                <p>Unable to fetch health data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { CheckCircle, AlertCircle } from 'lucide-react'