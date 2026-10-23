// lib/storage.ts
// The ONLY file that knows where receipts/images live (today: a private Supabase Storage bucket).
// The database stores just the object path (e.g. "<collection-id>/<uuid>.jpg"), never a URL, because
// the bucket is private and signed URLs expire. A usable URL is produced on demand by getImageUrl().
//
// To move to Cloudflare R2 (or anything else) later: reimplement these three functions
// (upload via a presigned PUT, view via a presigned GET, delete via an API route) and copy the
// existing objects across under the same paths. No database changes needed.
import type { SupabaseClient } from '@supabase/supabase-js'

export const IMAGE_BUCKET = 'receipts'
const VIEW_SECONDS = 300

export async function uploadImage(supabase: SupabaseClient, path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

/** Short-lived URL for showing a stored image to its creator. Returns null if it can't be opened. */
export async function getImageUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, VIEW_SECONDS)
  if (error || !data) return null
  return data.signedUrl
}

export async function removeImages(supabase: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await supabase.storage.from(IMAGE_BUCKET).remove(paths)
}
