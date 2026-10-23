// lib/storagePaths.ts
import type { FormField } from '@/lib/types'

/** Every receipt/image file a set of submissions points at (used when deleting, so no files are left behind). */
export function collectStoragePaths(
  subs: { receipt_path: string | null; form_data: Record<string, string> | null }[],
  fields: FormField[]
): string[] {
  const imageIds = fields.filter((f) => f.type === 'image').map((f) => String(f.id))
  const paths: string[] = []
  for (const s of subs) {
    if (s.receipt_path) paths.push(s.receipt_path)
    for (const id of imageIds) {
      const v = s.form_data?.[id]
      if (v) paths.push(v)
    }
  }
  return paths
}
