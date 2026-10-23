// components/SignInButton.tsx
'use client'
import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SignInButton({
  children = 'Create your first link →',
  className = 'px-6 py-3.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-sm',
}: {
  children?: React.ReactNode
  className?: string
}) {
  const supabase = createClientComponentClient()
  const [error, setError] = useState('')

  const signIn = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError('Error logging in with Google. Please try again.')
  }

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button onClick={signIn} className={className}>
        {children}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
