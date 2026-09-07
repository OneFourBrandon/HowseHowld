export async function currentPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration ? await registration.pushManager.getSubscription() : null
  } catch {
    // Restricted browser contexts must not prevent the household from loading.
    return null
  }
}

export async function renewPushSubscription(publicKey: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push notifications.')
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.active) throw new Error('The app is still installing. Reload once, then enable reminders.')
  const existing = await registration.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey })
}
