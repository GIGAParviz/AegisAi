import React from 'react'

export default function LocalePage({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">AegisAI</h1>
      <p className="text-muted">Production AI Knowledge Workspace</p>
      <nav className="mt-4">
        <a href="/en/dashboard" className="mr-4">Dashboard</a>
        <a href="/en/chat">Chat</a>
      </nav>
    </div>
  )
}