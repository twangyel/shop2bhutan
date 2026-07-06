import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.shop2bhutan.app',
  appName: 'Shop2Bhutan',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      backgroundColor: '#FFFFFF',
      style: 'LIGHT',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
    },
  },
}

export default config
