export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col">
      <header className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700 h-12">
        <span className="text-white font-medium text-sm">Room: {params.id}</span>
      </header>
      <div className="flex-1 relative">
        {/* Canvas component will be mounted here in Phase 2 */}
        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
          Canvas loading...
        </div>
      </div>
    </div>
  )
}
