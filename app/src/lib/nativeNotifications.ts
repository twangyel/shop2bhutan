import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

type PermissionDisplayState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown'

type NotificationLikeRow = {
  id?: string | null
  title?: string | null
  message?: string | null
  body?: string | null
  description?: string | null
  link?: string | null
  action_url?: string | null
  url?: string | null
  created_at?: string | null
  [key: string]: unknown
}

const CHANNEL_ID = 'shop2bhutan-updates'
const PERMISSION_DISMISSED_KEY = 'shop2bhutan:native-notifications-dismissed'

let channelReady = false

export function isNativeNotificationsAvailable() {
  return Capacitor.isNativePlatform()
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function makeNotificationId(value: unknown) {
  const text = cleanText(value)
  if (!text) return Date.now() % 2147483647

  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }

  return Math.max(1, hash % 2147483647)
}

async function ensureChannel() {
  if (!isNativeNotificationsAvailable() || channelReady) return

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Shop2Bhutan Updates',
      description: 'Order, quotation, payment, parcel, and account updates.',
      importance: 5,
      visibility: 1,
      lights: true,
      vibration: true,
    })
    channelReady = true
  } catch (error) {
    // Older Android/plugin combinations can ignore createChannel failures.
    console.warn('[nativeNotifications] Channel setup skipped:', error)
  }
}

export async function getNativeNotificationPermission(): Promise<PermissionDisplayState> {
  if (!isNativeNotificationsAvailable()) return 'granted'

  try {
    const result = await LocalNotifications.checkPermissions()
    return (result.display ?? 'unknown') as PermissionDisplayState
  } catch (error) {
    console.warn('[nativeNotifications] Permission check skipped:', error)
    return 'unknown'
  }
}

export async function requestNativeNotificationPermission(): Promise<PermissionDisplayState> {
  if (!isNativeNotificationsAvailable()) return 'granted'

  try {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') {
      await ensureChannel()
      return 'granted'
    }

    const requested = await LocalNotifications.requestPermissions()
    if (requested.display === 'granted') {
      clearNativeNotificationPromptDismissed()
      await ensureChannel()
    }

    return (requested.display ?? 'unknown') as PermissionDisplayState
  } catch (error) {
    console.warn('[nativeNotifications] Permission request skipped:', error)
    return 'unknown'
  }
}

export function isNativeNotificationPromptDismissed() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PERMISSION_DISMISSED_KEY) === '1'
}

export function dismissNativeNotificationPrompt() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PERMISSION_DISMISSED_KEY, '1')
}

export function clearNativeNotificationPromptDismissed() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PERMISSION_DISMISSED_KEY)
}

export function getNativeNotificationSettingsUrlHint() {
  return 'Open Android Settings > Apps > Shop2Bhutan > Notifications and enable notifications.'
}

export async function showNativeNotification(input: {
  title: string
  body: string
  link?: string
  id?: string
}) {
  if (!isNativeNotificationsAvailable()) return false

  const permission = await getNativeNotificationPermission()
  if (permission !== 'granted') return false

  await ensureChannel()

  const title = cleanText(input.title) || 'Shop2Bhutan'
  const body = cleanText(input.body) || 'You have a new update.'
  const link = cleanText(input.link)

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: makeNotificationId(input.id ?? `${title}:${body}:${Date.now()}`),
          title,
          body,
          channelId: CHANNEL_ID,
          extra: link ? { link } : undefined,
        } as any,
      ],
    })

    return true
  } catch (error) {
    console.warn('[nativeNotifications] Notification schedule skipped:', error)
    return false
  }
}

export async function showNativeNotificationFromRow(row: NotificationLikeRow) {
  const title = cleanText(row.title) || 'Shop2Bhutan update'
  const body =
    cleanText(row.message) ||
    cleanText(row.body) ||
    cleanText(row.description) ||
    'You have a new Shop2Bhutan notification.'
  const link = cleanText(row.link) || cleanText(row.action_url) || cleanText(row.url)

  return showNativeNotification({
    id: cleanText(row.id) || cleanText(row.created_at),
    title,
    body,
    link,
  })
}
