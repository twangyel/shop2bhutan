# Mobile App Strategy

## Current State

This project is a **React/Vite PWA-ready web application**. It is designed as a responsive web app that works on mobile browsers (Chrome, Safari) with an app-like experience.

### What works today
- Mobile-first responsive design optimized for 375px-428px screens
- PWA manifest and service-worker-ready structure
- Add-to-home-screen support on Android and iOS
- Offline skeleton screens prepared
- Bottom tab navigation (customer) and sidebar layout (admin)
- 31 screens: 17 customer + 14 admin

## Future Mobile Apps

Native Android and iOS applications will be created later using one of the following approaches:

### Option A: Capacitor (Recommended)

Ionic Capacitor wraps this existing web app into a native Android/iOS shell.

**Pros:**
- Reuses 100% of the current React codebase
- Access to native device features (camera, push notifications, file system)
- Native app store distribution (Google Play, App Store)
- Offline-first with native storage
- Best for keeping one codebase

**How it works:**
```bash
# Add Capacitor to this project
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios

# Build the web app
npm run build

# Sync web assets to native platforms
npx cap sync

# Open in Android Studio / Xcode
npx cap open android
npx cap open ios
```

### Option B: Expo (React Native)

A separate Expo project that shares the same design system and API but uses React Native components.

**Pros:**
- Truly native UI components (not a webview)
- Better performance for animations
- Deep native integration

**Cons:**
- Requires rewriting UI components in React Native
- Separate codebase from the web app
- More maintenance overhead

## PWA as Bridge

Until native apps are built, the PWA serves users who want an app-like experience:

| Feature | PWA (Now) | Capacitor (Future) | Expo (Future) |
|---------|-----------|-------------------|---------------|
| Install from browser | Yes | App Store only | App Store only |
| Push notifications | Limited | Full native | Full native |
| Camera access | Web API | Native | Native |
| File upload | Web | Native | Native |
| Offline mode | Service worker | Native storage | Native storage |
| Performance | Good | Best | Best |

## Migration Path

1. **Phase 1 (Now):** PWA web app — customers use browser or add to home screen
2. **Phase 2:** Add Capacitor, wrap the existing web app, publish to app stores
3. **Phase 3:** Gradually replace web screens with native Capacitor plugins for better UX
4. **Phase 4 (Optional):** If needed, build a dedicated Expo app with React Native

## Technical Notes

- All API calls are centralized in `src/data/mockData.ts` — replace with Supabase SDK when backend is ready
- `appSettings` in mock data controls feature flags (order coverage, delivery hubs, payment methods)
- Auth state is managed via React Context — will integrate with Capacitor's native auth plugins
- Camera access for payment screenshot upload uses web `<input type="file" accept="image/*">` — will use Capacitor Camera API later
