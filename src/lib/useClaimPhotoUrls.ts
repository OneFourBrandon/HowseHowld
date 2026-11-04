import { useEffect, useState } from 'react'
import { useAppData } from '../state/AppDataContext'

// Signed URLs last an hour. Reuse them across cards, and fetch fresh ones a
// little before they expire so a long-open app never shows broken photos.
const REUSE_FOR_MS = 50 * 60_000
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

export function useClaimPhotoUrls(paths: (string | undefined)[]) {
  const { claimPhotoUrls } = useAppData()
  const key = paths.filter((path): path is string => Boolean(path)).join('|')
  const [urls, setUrls] = useState<Record<string, string>>(() => cachedUrls(key ? key.split('|') : []))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const requested = key ? key.split('|') : []
    const missing = requested.filter(path => !cachedUrl(path))
    if (!missing.length) {
      setUrls(cachedUrls(requested))
      return
    }
    let cancelled = false
    claimPhotoUrls(missing)
      .then(found => {
        const expiresAt = Date.now() + REUSE_FOR_MS
        for (const [path, url] of found) signedUrls.set(path, { url, expiresAt })
        if (!cancelled) setUrls(cachedUrls(requested))
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [claimPhotoUrls, key])

  return { urls, failed }
}
