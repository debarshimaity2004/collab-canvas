'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Room { id: string; name: string; createdAt: string }
interface Session { accessToken: string; userId: string; name: string }

function readSession(): Session | null {
  try { return JSON.parse(localStorage.getItem('cc_session') ?? 'null') } catch { return null }
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Room thumbnail — deterministic SVG from room id ───────────────────────
const THUMB_PALETTES = [
  { bg: '#f5f3ff', shapes: ['#ddd6fe', '#c4b5fd'] },
  { bg: '#eff6ff', shapes: ['#bfdbfe', '#93c5fd'] },
  { bg: '#f0fdf4', shapes: ['#bbf7d0', '#86efac'] },
  { bg: '#fff7ed', shapes: ['#fed7aa', '#fdba74'] },
  { bg: '#fdf2f8', shapes: ['#f5d0fe', '#e879f9'] },
]

function RoomThumbnail({ id }: { id: string }) {
  const p = THUMB_PALETTES[id.charCodeAt(0) % THUMB_PALETTES.length]
  const s = id.charCodeAt(2) % 3
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 110" style={{ background: p.bg }}>
      {s === 0 && <>
        <rect x="20" y="25" width="80" height="45" rx="8" fill="white" stroke={p.shapes[0]} strokeWidth="1.5" />
        <rect x="120" y="35" width="70" height="40" rx="8" fill={p.bg} stroke={p.shapes[1]} strokeWidth="1.5" />
        <line x1="100" y1="47" x2="120" y2="55" stroke={p.shapes[0]} strokeWidth="1.5" strokeDasharray="4 3" />
      </>}
      {s === 1 && <>
        <ellipse cx="70" cy="55" rx="40" ry="28" fill="white" stroke={p.shapes[0]} strokeWidth="1.5" />
        <rect x="130" y="30" width="65" height="50" rx="8" fill={p.bg} stroke={p.shapes[1]} strokeWidth="1.5" />
        <line x1="110" y1="55" x2="130" y2="55" stroke={p.shapes[0]} strokeWidth="1.5" strokeDasharray="4 3" />
      </>}
      {s === 2 && <>
        <rect x="20" y="40" width="45" height="30" rx="6" fill="white" stroke={p.shapes[0]} strokeWidth="1.5" />
        <rect x="85" y="25" width="50" height="30" rx="6" fill="white" stroke={p.shapes[1]} strokeWidth="1.5" />
        <rect x="150" y="42" width="45" height="30" rx="6" fill="white" stroke={p.shapes[0]} strokeWidth="1.5" />
        <line x1="65" y1="55" x2="85" y2="40" stroke={p.shapes[0]} strokeWidth="1.2" />
        <line x1="135" y1="40" x2="150" y2="57" stroke={p.shapes[1]} strokeWidth="1.2" />
      </>}
    </svg>
  )
}

// ── Create Room Modal ────────────────────────────────────────────────────────
function CreateRoomModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (room: Room) => void
}) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const session = readSession()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !session) return
    setCreating(true)
    const res = await fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json()
    if (res.ok) onCreated(data.room)
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(9,9,11,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Create a new room</h2>
            <p className="text-sm text-zinc-500 mt-1">Set up a shared canvas for your team</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[13px] font-medium text-zinc-800 mb-2">Room name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. System design sprint"
              className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex-[1.8] py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              {creating ? 'Creating…' : 'Create room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ session }: { session: Session }) {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchRooms() }, [])

  async function fetchRooms() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
      const data = await res.json()
      setRooms(data.rooms ?? [])
    } finally {
      setLoading(false)
    }
  }

  function handleCreated(room: Room) {
    setShowModal(false)
    router.push(`/room/${room.id}`)
  }

  function signOut() {
    localStorage.removeItem('cc_session')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Nav */}
      <nav className="bg-white border-b border-zinc-200 px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L5 9l2.5 2.5L12 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CollabCanvas</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
            {initials(session.name)}
          </div>
          <button onClick={signOut} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Sign out</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">My rooms</h2>
            <p className="text-sm text-zinc-500 mt-0.5">{rooms.length} workspace{rooms.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            New room
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <span className="text-sm text-zinc-400">Loading…</span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => router.push(`/room/${room.id}`)}
                className="bg-white border border-zinc-200 rounded-xl overflow-hidden text-left hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <div className="h-28 overflow-hidden">
                  <RoomThumbnail id={room.id} />
                </div>
                <div className="p-4">
                  <p className="font-semibold text-sm text-zinc-900 group-hover:text-blue-600 transition-colors truncate">{room.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{new Date(room.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold">
                      {initials(session.name)}
                    </div>
                    <span className="text-zinc-400 text-xs group-hover:text-blue-500 transition-colors">Open →</span>
                  </div>
                </div>
              </button>
            ))}

            {/* New room card */}
            <button
              onClick={() => setShowModal(true)}
              className="border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center min-h-[214px] gap-2.5 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
            >
              <div className="w-10 h-10 bg-zinc-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v12M3 9h12" stroke="#09090b" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <span className="text-sm font-medium text-zinc-700">New room</span>
            </button>
          </div>
        )}
      </div>

      {showModal && <CreateRoomModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}

// ── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Nav */}
      <nav className="bg-white border-b border-zinc-100 px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14L5.5 10l3 3L14 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-base font-semibold tracking-tight">CollabCanvas</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm font-medium border border-zinc-200 rounded-lg bg-white text-zinc-700 hover:bg-zinc-50 transition-colors">Log in</Link>
          <Link href="/register" className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium px-3.5 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
          Real-time collaboration · Zero conflicts · Offline-first
        </div>
        <h1 className="text-5xl font-bold text-zinc-900 tracking-tight leading-tight mb-5">
          Draw together,<br />in real time
        </h1>
        <p className="text-base text-zinc-500 max-w-lg mx-auto mb-10 leading-relaxed">
          CollabCanvas lets teams sketch, diagram, and brainstorm on a shared canvas — with every change synced instantly across all devices.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/register" className="px-7 py-3 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition-colors">
            Start for free
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link href="/login" className="px-7 py-3 text-sm font-medium border border-zinc-200 bg-white text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors">
            Sign in
          </Link>
        </div>
      </div>

      {/* Canvas preview */}
      <div className="max-w-2xl mx-auto px-6 mb-20">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xl shadow-zinc-100">
          <div className="bg-zinc-50 border border-zinc-100 rounded-xl h-64 flex items-center justify-center relative overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 560 200">
              <rect x="40" y="55" width="150" height="80" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
              <text x="115" y="100" textAnchor="middle" fontSize="12" fontWeight="500" fill="#334155" fontFamily="system-ui">System architecture</text>
              <rect x="240" y="70" width="110" height="50" rx="10" fill="#f5f3ff" stroke="#ddd6fe" strokeWidth="1.5"/>
              <text x="295" y="100" textAnchor="middle" fontSize="12" fontWeight="500" fill="#6d28d9" fontFamily="system-ui">CRDT layer</text>
              <rect x="400" y="55" width="140" height="80" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
              <text x="470" y="100" textAnchor="middle" fontSize="12" fontWeight="500" fill="#334155" fontFamily="system-ui">WebSocket sync</text>
              <line x1="190" y1="95" x2="240" y2="95" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4"/>
              <line x1="350" y1="95" x2="400" y2="95" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4"/>
            </svg>
            <div className="absolute top-3 right-3 bg-white border border-zinc-200 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-700 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              3 users live
            </div>
            <div className="absolute bottom-3 left-3 flex">
              {[['D','#2563eb'],['A','#7c3aed'],['R','#0891b2']].map(([l,c]) => (
                <div key={l} className="-ml-1.5 first:ml-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white" style={{ background: c }}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-2xl mx-auto px-6 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5 mb-20">
        {[
          { icon: 'M4 8l3 3 6-6', label: 'CRDT powered', desc: 'No conflicts. Every edit merges automatically.' },
          { icon: 'M2 2l4 4m4-4L6 6m6 6l-4-4m-4 4l4-4', label: 'Works offline', desc: 'Draw offline, sync when you reconnect.' },
          { icon: 'M8 4a3 3 0 110 6 3 3 0 010-6zm-6 9a6 6 0 0112 0', label: 'Live presence', desc: 'See teammates\' cursors in real time.' },
        ].map(f => (
          <div key={f.label} className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
            <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d={f.icon} stroke="#18181b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p className="font-semibold text-sm text-zinc-900 mb-1.5">{f.label}</p>
            <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-10 border-t border-zinc-200 bg-white">
        <p className="text-xs font-medium text-zinc-400 tracking-widest uppercase">
          Built with Next.js · Yjs · WebSockets · Redis · PostgreSQL
        </p>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  useEffect(() => { setSession(readSession()) }, [])

  if (session === 'loading') return null
  if (!session) return <LandingPage />
  return <Dashboard session={session} />
}
