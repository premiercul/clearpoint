import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-bold">Page not found</h1>
      <Link href="/" className="text-xs text-gray-500 hover:underline">
        ← Back to ClearPoint
      </Link>
    </main>
  )
}
