import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { LocalNotifications } from '@capacitor/local-notifications'
import App from './App'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { AppToastProvider } from './components/shared/AppToast'

const isNativeApp = Capacitor.isNativePlatform()

function applyNativeAppClass() {
  if (!isNativeApp) return

  document.documentElement.classList.add('capacitor-native')
  document.body.classList.add('capacitor-native')
}

applyNativeAppClass()

function registerServiceWorker() {
  // Service workers are useful for the web/PWA build, but they can cause stale
  // cached assets inside the native WebView. Keep them disabled in Capacitor.
  if (isNativeApp || !('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        void registration.update()
      })
      .catch((error) => {
        console.warn('[Shop2Bhutan] Service worker registration failed:', error)
      })
  })
}

function setupNativeAppShell() {
  if (!isNativeApp) return

  void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined)
  void StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => undefined)

  void CapacitorApp.addListener('backButton', () => {
    const path = window.location.pathname

    if (path && path !== '/' && window.history.length > 1) {
      window.history.back()
      return
    }

    void CapacitorApp.exitApp()
  })
}


function setupNativeNotificationActions() {
  if (!isNativeApp) return

  void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const link = String(event.notification.extra?.link ?? '')

    if (link.startsWith('/') && !link.startsWith('//')) {
      window.history.pushState({}, '', link)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }).catch((error) => {
    console.warn('[Shop2Bhutan] Notification action listener skipped:', error)
  })
}

setupNativeAppShell()
setupNativeNotificationActions()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)

// Hide native splash manually after React has had a moment to mount.
// This prevents the app from staying on the default Capacitor splash screen.
if (isNativeApp) {
  window.setTimeout(() => {
    void SplashScreen.hide().catch((error) => {
      console.warn('[Shop2Bhutan] Splash hide skipped:', error)
    })
  }, 900)
}

registerServiceWorker()
