// components/PromoBanner.tsx
// A sponsored banner picked by the database for this placement. Renders nothing when there isn't one,
// so there's no empty gap and no layout jump. The box has a fixed 16:5 ratio.
'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Promo {
  id: string
  title: string
  image_path: string
  link_url: string
}

export default function PromoBanner({
  placement,
  collectionId,
  className = '',
}: {
  placement: 'dashboard' | 'landing' | 'payer_success'
  collectionId?: string // needed for payer_success so the creator's opt-out is honoured
  className?: string
}) {
  const supabase = createClientComponentClient()
  const [promo, setPromo] = useState<Promo | null>(null)
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_promotion', {
        p_placement: placement,
        p_collection_id: collectionId ?? null,
      })
      if (cancelled || error || !data) return
      const p = data as Promo
      if (!/^https:\/\//i.test(p.link_url)) return
      const { data: pub } = supabase.storage.from('promotions').getPublicUrl(p.image_path)
      setSrc(pub.publicUrl)
      setPromo(p)
    }
    load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [placement, collectionId, supabase])

  if (!promo || !src) return null

  return (
    <div className={className}>
      <a
        href={promo.link_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => {
          // fire and forget; the link opens in a new tab so this has time to finish
          supabase.rpc('track_promotion_click', { p_id: promo.id }).then(
            () => {},
            () => {}
          )
        }}
        className="block relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={promo.title} className="w-full aspect-[16/5] object-cover" loading="lazy" decoding="async" />
        <span className="absolute top-2 left-2 text-[10px] font-semibold bg-white/90 text-gray-700 rounded-full px-2 py-0.5">
          Sponsored
        </span>
      </a>
    </div>
  )
}
