// app/onboarding/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const accountTypes = [
  {
    id: 'academic',
    title: 'Class Rep / Lecturer / Department',
    placeholder: 'e.g., Course manuals, handouts, departmental dues, clearance',
  },
  {
    id: 'delivery',
    title: 'Delivery / Errand Runner (on campus)',
    placeholder: 'e.g., Food, printing and errands delivered to departments and lecture halls',
  },
  {
    id: 'vendor_social',
    title: 'Business / Vendor / Social',
    placeholder: 'e.g., Thrift, gadgets, food, merch, dinners, group projects',
  },
]

export default function OnboardingPage() {
  const [selectedType, setSelectedType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [isChange, setIsChange] = useState(false)

  // Returning users changing their type see their current one selected
  useEffect(() => {
    async function loadCurrent() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
      if (data?.account_type) {
        setSelectedType(data.account_type)
        setIsChange(true)
      }
    }
    loadCurrent()
  }, [supabase])

  const handleCompleteOnboarding = async () => {
    if (!selectedType) return
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/')
      return
    }

    // Update the profile; if the row somehow doesn't exist yet, create it.
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ account_type: selectedType })
      .eq('id', user.id)
      .select('id')

    let failed = !!updateError
    if (!failed && (!updated || updated.length === 0)) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ id: user.id, email: user.email ?? null, account_type: selectedType })
      failed = !!insertError
    }

    if (failed) {
      setLoading(false)
      setError('Error saving your profile. Please try again.')
      return
    }
    router.replace('/dashboard')
  }

  return (
    <main className="min-h-screen bg-white text-black flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{isChange ? 'Change your account type' : 'Select your account type'}</h1>
          <p className="text-sm text-gray-500">
            {isChange
              ? 'New links will use the type you pick. Your existing links keep working as they are.'
              : 'This sets up your forms, wording and dashboard for the way you work.'}
          </p>
        </div>

        <div className="space-y-3" role="radiogroup" aria-label="Account type">
          {accountTypes.map((type) => {
            const isSelected = selectedType === type.id
            return (
              <div
                key={type.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelectedType(type.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedType(type.id)
                  }
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-black bg-gray-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{type.title}</span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-black bg-black' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{type.placeholder}</p>
              </div>
            )
          })}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={handleCompleteOnboarding}
          disabled={!selectedType || loading}
          className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
            selectedType && !loading
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? 'Setting up...' : 'Continue to Dashboard'}
        </button>
      </div>
    </main>
  )
}
