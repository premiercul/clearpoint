'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-bold">Something went wrong</h1>
      <p className="text-xs text-gray-500">Please check your network and try again.</p>
      <button onClick={reset} className="px-4 py-2 bg-black text-white text-xs font-medium rounded-xl">
        Try again
      </button>
    </main>
  )
}
