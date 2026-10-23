// lib/image.ts
// Shrinks a phone screenshot/photo to a small JPEG before upload (saves the payer's data).
export async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('unsupported_image')
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('compress_failed')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress_failed'))), 'image/jpeg', quality)
  )
}

/** Sponsored banners: centre-crop to 16:5 and export as a small JPEG (1200x375 by default). */
export async function compressBanner(file: File, width = 1200, height = 375, quality = 0.8): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('unsupported_image')
  }
  const target = width / height
  const source = bitmap.width / bitmap.height
  let sw = bitmap.width
  let sh = bitmap.height
  let sx = 0
  let sy = 0
  if (source > target) {
    sw = Math.round(bitmap.height * target)
    sx = Math.round((bitmap.width - sw) / 2)
  } else {
    sh = Math.round(bitmap.width / target)
    sy = Math.round((bitmap.height - sh) / 2)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('compress_failed')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)
  bitmap.close?.()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress_failed'))), 'image/jpeg', quality)
  )
}
