import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentPushSubscription, renewPushSubscription } from './push'

const publicKey = 'AQIDBA'

function mockPushSupport(serviceWorker: Partial<ServiceWorkerContainer>) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  })
  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: class PushManager {},
  })
}

function subscriptionForKey(): PushSubscription {
  return {
    endpoint: 'https://push.example/device',
    expirationTime: null,
    options: {
      applicationServerKey: Uint8Array.from([1, 2, 3, 4]).buffer,
      userVisibleOnly: true,
    },
    getKey: vi.fn(),
    toJSON: vi.fn(),
    unsubscribe: vi.fn(),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('push subscriptions', () => {
  it('waits for the service worker to become active before subscribing', async () => {
    const subscription = subscriptionForKey()
    const subscribe = vi.fn().mockResolvedValue(subscription)
    const registration = {
      active: {} as ServiceWorker,
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe,
      },
    } as unknown as ServiceWorkerRegistration

    mockPushSupport({
      getRegistration: vi.fn().mockResolvedValue(undefined),
      ready: Promise.resolve(registration),
    })

    await expect(renewPushSubscription(publicKey)).resolves.toBe(subscription)
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from([1, 2, 3, 4]),
    })
  })

  it('reuses an existing subscription and lets the server record it again', async () => {
    const subscription = subscriptionForKey()
    const subscribe = vi.fn()
    const registration = {
      active: {} as ServiceWorker,
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(subscription),
        subscribe,
      },
    } as unknown as ServiceWorkerRegistration

    mockPushSupport({
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    })

    await expect(renewPushSubscription(publicKey)).resolves.toBe(subscription)
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('can wait for an active worker when sending a test', async () => {
    const subscription = subscriptionForKey()
    const registration = {
      active: {} as ServiceWorker,
      pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
    } as unknown as ServiceWorkerRegistration

    mockPushSupport({
      getRegistration: vi.fn().mockResolvedValue(undefined),
      ready: Promise.resolve(registration),
    })

    await expect(currentPushSubscription(true)).resolves.toBe(subscription)
  })
})
