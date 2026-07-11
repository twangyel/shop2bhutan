import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '@/lib/supabase'

const PUSH_DEVICE_ID_KEY = 'shop2bhutan:push-device-id'
const NATIVE_APP_ID = 'com.shop2bhutan.app'
const WEB_APP_ID = 'com.shop2bhutan.web'
const WEB_FIREBASE_APP_NAME = 'shop2bhutan-web-push'
const WEB_PUSH_SCOPE = '/firebase-cloud-messaging-push-scope/'

let nativeListenersReady = false
let webListenersReady = false
let currentUserId = ''
let currentAppId = ''
let lastNativeToken = ''
let registering = false

type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId: string
  appId: string
}

export type PushPermissionState =
  | 'unsupported'
  | 'unconfigured'
  | 'prompt'
  | 'granted'
  | 'denied'

export type RegisterPushDeviceOptions = {
  requestPermission?: boolean
}

export function isNativePushRuntime() {
  return Capacitor.isNativePlatform()
}

function makeFallbackId() {
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getDeviceId() {
  if (typeof window === 'undefined') return makeFallbackId()

  try {
    const existing = window.localStorage.getItem(PUSH_DEVICE_ID_KEY)
    if (existing) return existing

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : makeFallbackId()

    window.localStorage.setItem(PUSH_DEVICE_ID_KEY, generated)
    return generated
  } catch {
    return makeFallbackId()
  }
}

function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const config: FirebaseWebConfig = {
    apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
    projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
    storageBucket: String(
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    ).trim(),
    messagingSenderId: String(
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    ).trim(),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
  }

  if (
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.messagingSenderId ||
    !config.appId
  ) {
    return null
  }

  return config
}

function getWebVapidKey() {
  return String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim()
}

function makeServiceWorkerUrl(config: FirebaseWebConfig) {
  const url = new URL('/firebase-messaging-sw.js', window.location.origin)

  url.searchParams.set('apiKey', config.apiKey)
  url.searchParams.set('authDomain', config.authDomain)
  url.searchParams.set('projectId', config.projectId)
  url.searchParams.set('messagingSenderId', config.messagingSenderId)
  url.searchParams.set('appId', config.appId)

  if (config.storageBucket) {
    url.searchParams.set('storageBucket', config.storageBucket)
  }

  return url.toString()
}

async function savePushToken({
  token,
  platform,
  appId,
}: {
  token: string
  platform: string
  appId: string
}) {
  const cleanToken = String(token || '').trim()
  const userId = String(currentUserId || '').trim()

  if (!cleanToken || !userId) return false

  const deviceId = getDeviceId()

  // Preferred path: the existing security-definer RPC safely reassigns the
  // same device token when a phone/browser switches between customer/admin.
  const { error: rpcError } = await supabase.rpc('register_push_device_token', {
    p_token: cleanToken,
    p_device_id: deviceId,
    p_platform: platform,
    p_app_id: appId,
  })

  if (!rpcError) {
    console.info(
      `[pushNotifications] ${platform} token saved through registration RPC.`,
    )
    return true
  }

  console.warn(
    '[pushNotifications] RPC token save failed, trying direct upsert:',
    rpcError.message,
  )

  const now = new Date().toISOString()

  const payload = {
    user_id: userId,
    token: cleanToken,
    device_id: deviceId,
    platform,
    app_id: appId,
    is_active: true,
    last_seen_at: now,
    updated_at: now,
  }

  const { error } = await supabase
    .from('push_device_tokens')
    .upsert(payload, { onConflict: 'token' })

  if (error) {
    console.warn('[pushNotifications] Failed to save push token:', error.message)
    return false
  }

  console.info(
    `[pushNotifications] ${platform} token saved through direct upsert.`,
  )
  return true
}

async function ensureNativePushListeners() {
  if (nativeListenersReady || !isNativePushRuntime()) return

  await PushNotifications.addListener('registration', async (token) => {
    lastNativeToken = String(token.value || '').trim()

    await savePushToken({
      token: lastNativeToken,
      platform: Capacitor.getPlatform(),
      appId: NATIVE_APP_ID,
    })
  })

  await PushNotifications.addListener('registrationError', (error) => {
    console.warn('[pushNotifications] Native registration error:', error)
  })

  await PushNotifications.addListener(
    'pushNotificationReceived',
    (notification) => {
      console.info(
        '[pushNotifications] Push received while native app is open:',
        notification,
      )
      window.dispatchEvent(
        new Event('shop2bhutan:notifications-updated'),
      )
    },
  )

  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (event) => {
      const data = event.notification.data ?? {}
      const link = String(data.link || data.url || data.action_url || '')

      if (link.startsWith('/') && !link.startsWith('//')) {
        window.dispatchEvent(
          new CustomEvent('shop2bhutan:push-notification-opened', {
            detail: { link },
          }),
        )
      }
    },
  )

  nativeListenersReady = true
}

async function getWebMessagingContext() {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return null
  }

  const config = getFirebaseWebConfig()
  const vapidKey = getWebVapidKey()

  if (!config || !vapidKey) return null

  const [{ getApp, getApps, initializeApp }, messagingModule] =
    await Promise.all([import('firebase/app'), import('firebase/messaging')])

  const supported = await messagingModule.isSupported()
  if (!supported) return null

  const firebaseApp =
    getApps().find((app) => app.name === WEB_FIREBASE_APP_NAME) ??
    initializeApp(config, WEB_FIREBASE_APP_NAME)

  const messaging = messagingModule.getMessaging(
    getApp(firebaseApp.name),
  )

  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    makeServiceWorkerUrl(config),
    {
      scope: WEB_PUSH_SCOPE,
      updateViaCache: 'none',
    },
  )

  await serviceWorkerRegistration.update().catch(() => undefined)

  if (!webListenersReady) {
    messagingModule.onMessage(messaging, (payload) => {
      console.info(
        '[pushNotifications] Web push received while app is open:',
        payload,
      )

      window.dispatchEvent(
        new CustomEvent('shop2bhutan:web-push-received', {
          detail: payload,
        }),
      )
      window.dispatchEvent(
        new Event('shop2bhutan:notifications-updated'),
      )
    })

    webListenersReady = true
  }

  return {
    messaging,
    messagingModule,
    serviceWorkerRegistration,
    vapidKey,
  }
}

async function registerNativePush(
  options: RegisterPushDeviceOptions,
) {
  await ensureNativePushListeners()

  const currentPermission = await PushNotifications.checkPermissions()
  let receivePermission = currentPermission.receive

  if (receivePermission !== 'granted') {
    if (!options.requestPermission) {
      console.info(
        '[pushNotifications] Native permission is waiting for user action.',
      )
      return false
    }

    const requestedPermission =
      await PushNotifications.requestPermissions()
    receivePermission = requestedPermission.receive
  }

  if (receivePermission !== 'granted') return false

  currentAppId = NATIVE_APP_ID

  if (lastNativeToken) {
    await savePushToken({
      token: lastNativeToken,
      platform: Capacitor.getPlatform(),
      appId: NATIVE_APP_ID,
    })
  }

  await PushNotifications.register()
  return true
}

async function registerWebPush(
  options: RegisterPushDeviceOptions,
) {
  const context = await getWebMessagingContext()
  if (!context) return false

  let permission = Notification.permission

  if (permission === 'default' && options.requestPermission) {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    if (!options.requestPermission) {
      console.info(
        '[pushNotifications] Web permission is waiting for user action.',
      )
    }
    return false
  }

  const token = await context.messagingModule.getToken(
    context.messaging,
    {
      vapidKey: context.vapidKey,
      serviceWorkerRegistration: context.serviceWorkerRegistration,
    },
  )

  if (!token) {
    console.warn('[pushNotifications] Firebase returned no web push token.')
    return false
  }

  currentAppId = WEB_APP_ID

  return savePushToken({
    token,
    platform: 'web',
    appId: WEB_APP_ID,
  })
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (isNativePushRuntime()) {
    try {
      const permission = await PushNotifications.checkPermissions()

      if (permission.receive === 'granted') return 'granted'
      if (permission.receive === 'denied') return 'denied'
      return 'prompt'
    } catch {
      return 'unsupported'
    }
  }

  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return 'unsupported'
  }

  if (!getFirebaseWebConfig() || !getWebVapidKey()) {
    return 'unconfigured'
  }

  try {
    const { isSupported } = await import('firebase/messaging')
    if (!(await isSupported())) return 'unsupported'
  } catch {
    return 'unsupported'
  }

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'prompt'
}

export async function registerPushDeviceForUser(
  userId: string,
  options: RegisterPushDeviceOptions = {},
) {
  const cleanUserId = String(userId || '').trim()
  if (!cleanUserId || registering) return false

  currentUserId = cleanUserId
  registering = true

  try {
    if (isNativePushRuntime()) {
      return await registerNativePush(options)
    }

    return await registerWebPush(options)
  } catch (error) {
    console.warn('[pushNotifications] Push registration skipped:', error)
    return false
  } finally {
    registering = false
  }
}

export async function unregisterPushDeviceForCurrentUser() {
  if (!currentUserId) return

  const appId =
    currentAppId ||
    (isNativePushRuntime() ? NATIVE_APP_ID : WEB_APP_ID)

  try {
    await supabase
      .from('push_device_tokens')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', currentUserId)
      .eq('device_id', getDeviceId())
      .eq('app_id', appId)
  } catch (error) {
    console.warn('[pushNotifications] Token deactivation skipped:', error)
  } finally {
    currentUserId = ''
    currentAppId = ''
  }
}
