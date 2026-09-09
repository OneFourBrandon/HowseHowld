const SERVICE_WORKER_READY_TIMEOUT_MS = 20_000

function waitForActiveServiceWorker() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Reminders could not finish starting. Close and reopen the app, then try again.'))
    }, SERVICE_WORKER_READY_TIMEOUT_MS)
  })

  return Promise.race([navigator.serviceWorker.ready, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

function decodeApplicationServerKey(publicKey: string) {
  const padding = '='.repeat((4 - publicKey.length % 4) % 4)
  const normalized = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0))
}

function subscriptionUsesKey(subscription: PushSubscription, publicKey: string) {
  const existingKey = subscription.options.applicationServerKey
  if (!existingKey) return false

  const expected = decodeApplicationServerKey(publicKey)
  const existing = new Uint8Array(existingKey)
  return existing.length === expected.length && existing.every((value, index) => value === expected[index])
}

export async function currentPushSubscription(waitUntilReady = false) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration?.active) return registration.pushManager.getSubscription()
    if (!waitUntilReady) return null
    const readyRegistration = await waitForActiveServiceWorker()
    return readyRegistration.pushManager.getSubscription()
  } catch {
    // Restricted browser contexts must not prevent the household from loading.
    return null
  }
}

export async function renewPushSubscription(publicKey: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push notifications.')
  const registration = await waitForActiveServiceWorker()
  const existing = await registration.pushManager.getSubscription()
  if (existing && subscriptionUsesKey(existing, publicKey)) return existing
  if (existing) await existing.unsubscribe()
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(publicKey),
  })
}
