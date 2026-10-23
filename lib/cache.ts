// lib/cache.ts
// Offline fallback for the creator's submissions list. Uses sessionStorage (cleared when the
// tab closes) instead of localStorage, and is wiped on sign-out, because it holds student details.
const PREFIX = 'clearpoint_subs_'

export function cacheSubmissions(collectionId: string, data: unknown) {
  try {
    sessionStorage.setItem(PREFIX + collectionId, JSON.stringify(data))
  } catch {}
}

export function readCachedSubmissions<T>(collectionId: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + collectionId)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearAllCaches() {
  try {
    for (const store of [sessionStorage, localStorage]) {
      Object.keys(store)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => store.removeItem(k))
    }
  } catch {}
}
