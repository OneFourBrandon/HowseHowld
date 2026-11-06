import { useCallback, useEffect, useState } from 'react'
import { useAppData } from '../state/AppDataContext'

// Signed URLs last an hour. Reuse them across cards, and fetch fresh ones a
// little before they expire so a long-open app never shows broken photos.
const REUSE_FOR_MS = 50 * 60_000
const RETRY_AFTER_MS = 15_000
const signedUrls = new Map<string, { url: string; expiresAt: number }>()

function cachedUrl(path: string) {
  const entry = signedUrls.get(path)
  if (!entry) return undefined
  if (entry.expiresAt > Date.now()) return entry.url
  signedUrls.delete(path)
  return undefined
}

function cachedUrls(paths: string[]) {
  return Object.fromEntries(paths.flatMap(path => {
    const url = cachedUrl(path)
    return url ? [[path, url]] : []
  }))
}

/**
 * Signed URLs for claim photos. `refresh` drops a cached URL (for example when
 * an image fails to load because its URL expired) and fetches a new one.
 */
export function useClaimPhotoUrls(paths: (string | undefined)[]) {
  const { claimPhotoUrls } = useAppData()
  const key = paths.filter((path): path is string => Boolean(path)).join('|')
  const [urls, setUrls] = useState<Record<string, string>>(() => cachedUrls(key ? key.split('|') : []))
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const requested = key ? key.split('|') : []
    const missing = requested.filter(path => !cachedUrl(path))
    if (!missing.length) {
      setUrls(cachedUrls(requested))
      setFailed(false)
      return
    }
    let cancelled = false
    let retry: number | undefined
    claimPhotoUrls(missing)
      .then(found => {
        const expiresAt = Date.now() + REUSE_FOR_MS
        for (const [path, url] of found) signedUrls.set(path, { url, expiresAt })
        if (cancelled) return
        setUrls(cachedUrls(requested))
        setFailed(false)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        retry = window.setTimeout(() => setAttempt(value => value + 1), RETRY_AFTER_MS)
      })
    return () => {
      cancelled = true
      window.clearTimeout(retry)
    }
  }, [attempt, claimPhotoUrls, key])

  const refresh = useCallback((path: string) => {
    signedUrls.delete(path)
    setAttempt(value => value + 1)
  }, [])

  return { urls, failed, refresh }
}
