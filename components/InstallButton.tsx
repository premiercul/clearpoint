// components/InstallButton.tsx
// "Install app" for creators. Chrome and Edge give us a one-tap prompt; iPhones have no such prompt,
// so there we show the two-step instruction instead. Hidden once the app is installed.
'use client'
import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) {
      setInstalled(true)
      return
    }
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent))

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || (!deferred && !isIos)) return null

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
    } else {
      setShowHelp((v) => !v)
    }
  }

  return (
    <span className="relative inline-block">
      <button type="button" onClick={onClick} className={className || 'text-xs font-medium hover:underline'}>
        Install app
      </button>
      {showHelp && (
        <span className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 text-left text-xs text-gray-700 shadow-lg z-20">
          Tap the Share icon in Safari, then choose <strong>Add to Home Screen</strong>.
        </span>
      )}
    </span>
  )
}
