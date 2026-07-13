import { Capacitor } from '@capacitor/core'
import {
  Keyboard,
  type KeyboardInfo,
} from '@capacitor/keyboard'

export type AppKeyboardState = {
  isOpen: boolean
  height: number
}

type KeyboardStateListener = (state: AppKeyboardState) => void

const KEYBOARD_OPEN_CLASS = 'shop2bhutan-keyboard-open'
const KEYBOARD_HEIGHT_PROPERTY = '--keyboard-height'

function isNativeKeyboardRuntime() {
  return Capacitor.isNativePlatform()
}

function setDocumentKeyboardState(state: AppKeyboardState) {
  if (typeof document === 'undefined') return

  document.documentElement.style.setProperty(
    KEYBOARD_HEIGHT_PROPERTY,
    `${Math.max(0, Math.round(state.height))}px`,
  )

  document.body.classList.toggle(
    KEYBOARD_OPEN_CLASS,
    state.isOpen,
  )
}

function scrollFocusedFieldIntoView() {
  if (typeof document === 'undefined') return

  const activeElement = document.activeElement

  if (!(activeElement instanceof HTMLElement)) return

  const isEditable =
    activeElement.matches(
      'input, textarea, select, [contenteditable="true"]',
    )

  if (!isEditable) return

  window.setTimeout(() => {
    activeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }, 120)
}

function keyboardHeight(info: KeyboardInfo) {
  const height = Number(info.keyboardHeight || 0)
  return Number.isFinite(height) ? Math.max(0, height) : 0
}

export async function subscribeToKeyboardState(
  listener: KeyboardStateListener,
) {
  if (!isNativeKeyboardRuntime()) {
    setDocumentKeyboardState({
      isOpen: false,
      height: 0,
    })

    listener({
      isOpen: false,
      height: 0,
    })

    return async () => {}
  }

  const showKeyboard = (info: KeyboardInfo) => {
    const state = {
      isOpen: true,
      height: keyboardHeight(info),
    }

    setDocumentKeyboardState(state)
    listener(state)
    scrollFocusedFieldIntoView()
  }

  const hideKeyboard = () => {
    const state = {
      isOpen: false,
      height: 0,
    }

    setDocumentKeyboardState(state)
    listener(state)
  }

  const handles = await Promise.all([
    Keyboard.addListener('keyboardWillShow', showKeyboard),
    Keyboard.addListener('keyboardDidShow', showKeyboard),
    Keyboard.addListener('keyboardWillHide', hideKeyboard),
    Keyboard.addListener('keyboardDidHide', hideKeyboard),
  ])

  return async () => {
    await Promise.all(
      handles.map(async (handle) => {
        try {
          await handle.remove()
        } catch {
          // Listener may already be unavailable during app shutdown.
        }
      }),
    )

    hideKeyboard()
  }
}

export async function dismissAppKeyboard() {
  if (typeof document !== 'undefined') {
    const activeElement = document.activeElement

    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }
  }

  if (!isNativeKeyboardRuntime()) return

  try {
    await Keyboard.hide()
  } catch (error) {
    console.warn('[Keyboard] Hide skipped:', error)
  }
}
