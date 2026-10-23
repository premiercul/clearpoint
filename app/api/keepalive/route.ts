// app/api/keepalive/route.ts
// Pinged on a schedule (Vercel Cron, GitHub Actions, cron-job.org, UptimeRobot...) so the free
// Supabase project keeps seeing database activity and doesn't auto-pause.
// If CRON_SECRET is set, callers must send "Authorization: Bearer <CRON_SECRET>"
// (Vercel Cron does this automatically when the CRON_SECRET env var exists).
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const ping = await supabase.rpc('keepalive')
  // a second, read-only request against the collections table
  await supabase.rpc('get_public_collection', { p_id: NIL_UUID })

  if (ping.error) {
    return NextResponse.json({ ok: false, error: 'database_unreachable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ ok: true, pinged_at: ping.data }, { headers: { 'Cache-Control': 'no-store' } })
}
