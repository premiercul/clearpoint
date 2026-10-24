// components/PwaRegister.tsx
'use client'
import { useEffect } from 'react'

// Registers the offline-page service worker in production only (it would just get in the way of local development).
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }, [])
  return null
}
