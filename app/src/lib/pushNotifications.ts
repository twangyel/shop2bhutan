import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '@/lib/supabase'

const PUSH_DEVICE_ID_KEY = 'shop2bhutan:push-device-id'
const APP_ID = 'com.shop2bhutan.app'

let listenersReady = false
let currentUserId = ''
let lastToken = ''
let registering = false

function isNativePushAvailable() {
  return Capacitor.isNativePlatform()
}

function makeFallbackId() {
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getDeviceId() {
  if (typeof window === 'undefined') return makeFallbackId()

  const existing = window.localStorage.getItem(PUSH_DEVICE_ID_KEY)
  if (existing) return existing

  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : makeFallbackId()

  window.localStorage.setItem(PUSH_DEVICE_ID_KEY, generated)
  return generated
}

async function savePushToken(token: string) {
  const cleanToken = String(token || '').trim()
  const userId = String(currentUserId || '').trim()

  if (!cleanToken || !userId) return false

  const deviceId = getDeviceId()
  const platform = Capacitor.getPlatform()

  // Preferred path: security-definer RPC. This handles same-phone
  // customer/admin account switching where the same FCM token may already
  // belong to a different user row and normal RLS upsert can be blocked.
  const { error: rpcError } = await supabase.rpc('register_push_device_token', {
    p_token: cleanToken,
    p_device_id: deviceId,
    p_platform: platform,
    p_app_id: APP_ID,
  })

  if (!rpcError) {
    console.info('[pushNotifications] FCM token saved via RPC.')
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
    app_id: APP_ID,
    is_active: true,
    last_seen_at: now,
    updated_at: now,
  }

  const { error } = await supabase
    .from('push_device_tokens')
    .upsert(payload, { onConflict: 'token' })

  if (error) {
    console.warn('[pushNotifications] Failed to save FCM token:', error.message)
    return false
  }

  console.info('[pushNotifications] FCM token saved via direct upsert.')
  return true
}

async function ensurePushListeners() {
  if (listenersReady || !isNativePushAvailable()) return

  await PushNotifications.addListener('registration', async (token) => {
    lastToken = String(token.value || '').trim()
    console.info('[pushNotifications] FCM token received:', lastToken)
    await savePushToken(lastToken)
  })

  await PushNotifications.addListener('registrationError', (error) => {
    console.warn('[pushNotifications] Registration error:', error)
  })

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.info(
      '[pushNotifications] Push received while app is open:',
      notification,
    )
  })

  await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const data = event.notification.data ?? {}
    const link = String(data.link || data.url || data.action_url || '')

    if (link.startsWith('/') && !link.startsWith('//')) {
      window.dispatchEvent(
        new CustomEvent('shop2bhutan:push-notification-opened', {
          detail: { link },
        }),
      )
    }
  })

  listenersReady = true
}

export type RegisterPushDeviceOptions = {
  requestPermission?: boolean
}

export async function registerPushDeviceForUser(
  userId: string,
  options: RegisterPushDeviceOptions = {},
) {
  if (!isNativePushAvailable()) return false

  const cleanUserId = String(userId || '').trim()
  if (!cleanUserId || registering) return false

  currentUserId = cleanUserId
  registering = true

  try {
    await ensurePushListeners()

    const currentPermission = await PushNotifications.checkPermissions()
    let receivePermission = currentPermission.receive

    // Important UX rule:
    // Do not show the Android system permission dialog automatically on login.
    // The app should first show its own explanation card/banner, and only ask
    // Android permission after the user taps "Enable".
    if (receivePermission !== 'granted') {
      if (!options.requestPermission) {
        console.info('[pushNotifications] Push permission not granted yet; waiting for user action.')
        return false
      }

      const requestedPermission = await PushNotifications.requestPermissions()
      receivePermission = requestedPermission.receive
    }

    if (receivePermission !== 'granted') {
      console.warn('[pushNotifications] Push permission not granted.')
      return false
    }

    // If this app process already received a token earlier, save it again for
    // the currently logged-in user. This keeps admin/customer account switches
    // and deleted token rows from getting stuck until Firebase re-emits a token.
    if (lastToken) {
      await savePushToken(lastToken)
    }

    await PushNotifications.register()
    return true
  } catch (error) {
    console.warn('[pushNotifications] Push registration skipped:', error)
    return false
  } finally {
    registering = false
  }
}

export async function unregisterPushDeviceForCurrentUser() {
  if (!isNativePushAvailable() || !currentUserId) return

  try {
    await supabase
      .from('push_device_tokens')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', currentUserId)
      .eq('device_id', getDeviceId())
  } catch (error) {
    console.warn('[pushNotifications] Token deactivate skipped:', error)
  } finally {
    currentUserId = ''
  }
}
