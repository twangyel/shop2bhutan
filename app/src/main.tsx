import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Ask Chrome to check for a newer service worker after each app load.
        void registration.update()
      })
      .catch((error) => {
        console.warn('[Shop2Bhutan] Service worker registration failed:', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

registerServiceWorker()
