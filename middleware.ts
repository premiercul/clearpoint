// middleware.ts — keeps signed-out visitors out of the creator area.
// (Real data protection is still enforced by Row Level Security in Supabase.)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding', '/super-admin'],
}
