// app/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { clearAllCaches } from '@/lib/cache'
import { collectStoragePaths } from '@/lib/storagePaths'
import { describePricing, resolvePricing } from '@/lib/pricing'
import { TEMPLATES } from '@/lib/templates'
import PromoBanner from '@/components/PromoBanner'
import InstallButton from '@/components/InstallButton'
import { removeImages } from '@/lib/storage'
import type { Collection, Template } from '@/lib/types'

export default function DashboardPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [suspended, setSuspended] = useState(false)
  const [accountType, setAccountType] = useState<Template>('academic')
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('suspended, account_type')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.suspended) setSuspended(true)
      const t = profile?.account_type as Template | null | undefined
      if (!t || !TEMPLATES[t]) {
        router.replace('/onboarding') // finish choosing an account type first
        return
      }
      setAccountType(t)

      const { data, error } = await supabase
        .from('collections')
        .select('*, submissions(count)')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })

      if (error) setError('Could not load your collections. Check your network and refresh.')
      else setCollections((data as Collection[]) || [])
      setLoading(false)
    }

    loadDashboard()
  }, [router, supabase])

  const copyToClipboard = async (id: string) => {
    const url = `${window.location.origin}/pay/${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const toggleActive = async (col: Collection) => {
    setError('')
    const next = !col.is_active
    const { error } = await supabase.from('collections').update({ is_active: next }).eq('id', col.id)
    if (error) {
      setError('Could not update the link. Please try again.')
      return
    }
    setCollections((cols) => cols.map((c) => (c.id === col.id ? { ...c, is_active: next } : c)))
  }

  const toggleSponsored = async (col: Collection) => {
    setError('')
    const next = !(col.show_sponsored ?? true)
    const { error } = await supabase.from('collections').update({ show_sponsored: next }).eq('id', col.id)
    if (error) {
      setError('Could not update that setting. Please try again.')
      return
    }
    setCollections((cols) => cols.map((c) => (c.id === col.id ? { ...c, show_sponsored: next } : c)))
  }

  const deleteCollection = async (col: Collection) => {
    if (!window.confirm(`Delete "${col.title}" and ALL its submissions and receipts? This cannot be undone.`)) return
    setError('')

    // remove receipt files first (database cascade doesn't touch storage)
    const { data: subs } = await supabase
      .from('submissions')
      .select('receipt_path, form_data')
      .eq('collection_id', col.id)
    const paths = collectStoragePaths(
      (subs || []) as { receipt_path: string | null; form_data: Record<string, string> | null }[],
      col.custom_fields || []
    )
    await removeImages(supabase, paths)

    const { error } = await supabase.from('collections').delete().eq('id', col.id)
    if (error) {
      setError('Could not delete the collection. Please try again.')
      return
    }
    setCollections((cols) => cols.filter((c) => c.id !== col.id))
  }

  const signOut = async () => {
    clearAllCaches()
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <main className="min-h-screen bg-gray-50 text-black">
      {/* Navbar */}
      <nav className="bg-white border-b px-4 sm:px-8 py-4 flex justify-between items-center">
        <h1 className="font-bold tracking-tight text-lg">ClearPoint</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="hidden sm:inline">{user?.email}</span>
          <Link href="/onboarding" className="hidden sm:inline text-xs hover:underline" title="Change your account type">
            {TEMPLATES[accountType].label}
          </Link>
          <InstallButton className="text-xs font-medium hover:underline" />
          <button onClick={signOut} className="text-red-600 hover:underline text-xs font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-8 py-8 space-y-6">
        {/* Header Action Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold">{TEMPLATES[accountType].copy.listTitle}</h2>
            <p className="text-sm text-gray-500">{TEMPLATES[accountType].copy.listBlurb}</p>
          </div>
          <Link
            href="/dashboard/create"
            className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {TEMPLATES[accountType].copy.newButton}
          </Link>
        </div>

        {suspended && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-4 py-3">
            Your account has been suspended by ClearPoint, so your links are closed and you can&apos;t create new ones. Contact support if you think this is a mistake.
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>}

        <PromoBanner placement="dashboard" />

        {/* Collections List */}
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Loading your collections...</div>
        ) : collections.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3">
            <h3 className="font-semibold text-gray-800">{TEMPLATES[accountType].copy.emptyTitle}</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {TEMPLATES[accountType].copy.emptyBody}
            </p>
            <Link
              href="/dashboard/create"
              className="inline-block mt-2 px-4 py-2 bg-black text-white rounded-xl text-xs font-medium"
            >
              {TEMPLATES[accountType].copy.emptyButton}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {collections.map((col) => {
              const submissionCount = col.submissions?.[0]?.count || 0
              const deadlinePassed = !!col.closes_at && new Date(col.closes_at).getTime() <= Date.now()
              const takenDown = !!col.admin_disabled
              const isClosed = takenDown || !col.is_active || deadlinePassed
              return (
                <div
                  key={col.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{col.title}</h3>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                        {submissionCount} {submissionCount === 1 ? TEMPLATES[col.template ?? 'academic'].copy.unitSingular : TEMPLATES[col.template ?? 'academic'].copy.unitPlural}
                      </span>
                      {isClosed && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          {takenDown ? 'Taken down by ClearPoint' : 'Closed'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {TEMPLATES[col.template ?? 'academic']?.label} · {describePricing(resolvePricing(col))}
                      {col.closes_at && !deadlinePassed ? ` · closes ${new Date(col.closes_at).toLocaleString()}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 line-clamp-1">{col.description || 'No description provided'}</p>
                    {takenDown && (
                      <p className="text-xs text-red-600">{col.admin_note || 'This link was closed by ClearPoint.'}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => copyToClipboard(col.id)}
                      className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50"
                    >
                      {copiedId === col.id ? 'Copied!' : 'Copy Link'}
                    </button>
                    {!takenDown && (
                      <button
                        onClick={() => toggleActive(col)}
                        className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50"
                      >
                        {col.is_active ? 'Close Link' : 'Reopen Link'}
                      </button>
                    )}
                    <button
                      onClick={() => toggleSponsored(col)}
                      title="Show a small sponsored banner on the screen payers see after they submit"
                      className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50"
                    >
                      Payer ads: {(col.show_sponsored ?? true) ? 'On' : 'Off'}
                    </button>
                    <button
                      onClick={() => deleteCollection(col)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                    >
                      Delete
                    </button>
                    <Link
                      href={`/dashboard/${col.id}`}
                      className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800"
                    >
                      {TEMPLATES[col.template ?? 'academic'].copy.viewButton}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
