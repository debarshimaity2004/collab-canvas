'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Canvas } from '../../../components/Canvas'
import { Toolbar } from '../../../components/Toolbar'
import { useCollaboration } from '../../../hooks/useCollaboration'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface AuthSession {
  accessToken: string
  userId: string
  name: string
}

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem('cc_session')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ── Invite modal ──────────────────────────────────────────────────────────────
function InviteModal({ roomId, token, onClose }: { roomId: string; token: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const roomUrl = typeof window !== 'undefined' ? window.location.href : ''

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    const res = await fetch(`${API_URL}/api/rooms/${roomId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: email.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setMessage(`${email} can now access this room.`)
      setEmail('')
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Could not invite user.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Invite to room</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Share link */}
        <div className="mb-5">
          <p className="text-xs text-gray-400 mb-2 font-medium">Room link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={roomUrl}
              className="flex-1 px-3 py-2 text-xs bg-gray-900 border border-gray-600 rounded-lg text-gray-300 focus:outline-none"
            />
            <button
              onClick={() => navigator.clipboard.writeText(roomUrl)}
              className="px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Anyone with an account can join via this link.</p>
        </div>

        <div className="border-t border-gray-700 my-4" />

        {/* Invite by email */}
        <p className="text-xs text-gray-400 mb-2 font-medium">Invite by email</p>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="flex-1 px-3 py-2 text-sm bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
          />
          <button
            type="submit"
            disabled={status === 'loading' || !email.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {status === 'loading' ? '…' : 'Invite'}
          </button>
        </form>

        {status === 'success' && (
          <p className="mt-2 text-xs text-green-400">✓ {message}</p>
        )}
        {status === 'error' && (
          <p className="mt-2 text-xs text-red-400">{message}</p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          The user must already have a CollabCanvas account.
        </p>
      </div>
    </div>
  )
}

// ── Room page ─────────────────────────────────────────────────────────────────
export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.id as string

  const [session, setSession] = useState<AuthSession | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const exportFnRef = useRef<(() => void) | null>(null)
  const handleExportReady = useCallback((fn: () => void) => { exportFnRef.current = fn }, [])

  useEffect(() => {
    const s = readSession()
    if (!s) {
      router.replace('/login')
      return
    }
    setSession(s)
    setHydrated(true)
  }, [router])

  const { shapes, undoManager, connected, cursors, sendCursor } = useCollaboration(
    roomId,
    session?.accessToken ?? null,
    session?.userId ?? '',
    session?.name ?? 'Guest'
  )

  if (!hydrated) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading…</span>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 h-12 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-white font-semibold text-sm">CollabCanvas</span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-400 text-xs font-mono">{roomId.slice(0, 8)}…</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection dot */}
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400'}`}
            title={connected ? 'Connected' : 'Connecting…'}
          />

          {/* Online users from cursors */}
          {cursors.size > 0 && (
            <span className="text-xs text-gray-400">{cursors.size + 1} online</span>
          )}

          {/* Export PNG button */}
          <button
            onClick={() => exportFnRef.current?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 font-medium transition-colors"
            title="Export canvas as PNG"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 9.5v.5a1 1 0 001 1h8a1 1 0 001-1v-.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Export
          </button>

          {/* Invite button */}
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 1a2 2 0 110 4 2 2 0 010-4zM1 9.5C1 7.5 3 6 5 6h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M9 8v4M7 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Invite
          </button>

          <span className="text-gray-400 text-xs ml-1">{session?.name}</span>
        </div>
      </header>

      <div className="flex-1 relative">
        <Toolbar undoManager={undoManager} />
        <Canvas
          shapes={shapes}
          userId={session?.userId ?? ''}
          cursors={cursors}
          sendCursor={sendCursor}
          onExportReady={handleExportReady}
        />
      </div>

      {showInvite && session && (
        <InviteModal
          roomId={roomId}
          token={session.accessToken}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  )
}
