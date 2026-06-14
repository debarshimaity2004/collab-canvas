export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-4xl font-bold tracking-tight">CollabCanvas</h1>
      <p className="mt-3 text-gray-400">Real-time collaborative whiteboard</p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          Sign in
        </a>
        <a
          href="/register"
          className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium hover:border-gray-500 transition-colors"
        >
          Create account
        </a>
      </div>
    </main>
  )
}
