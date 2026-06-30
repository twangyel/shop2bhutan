# Shop2Bhutan

A proxy shopping platform for Bhutan. Customers can browse products inside the app or paste product links from Amazon, Flipkart, Myntra, and Meesho. Orders are accepted from all 20 dzongkhags with pickup/delivery hubs in Thimphu, Phuntsholing, and Paro.

> **Platform Note:** This is currently a React/Vite PWA-ready web app. Android and iOS native apps will be created later using Capacitor or Expo. See [MOBILE.md](./MOBILE.md) for the full mobile strategy.

---

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** (40+ pre-installed components)
- **React Router DOM** (client-side routing)
- **Recharts** (admin data visualization)
- **date-fns** (relative time formatting)
- **PWA-ready** (manifest.json, service worker structure, app icons)

## Project Structure

```
src/
  components/
    ui/              # shadcn/ui components (40+)
    shared/          # Reusable: ProductCard, OrderCard, StatusBadge, TrackingTimeline, EmptyState
    customer/        # Customer-specific: HeroBanner, PasteLinkCard, QuickActions, CategoryScroll,
                     #   ProductSection, TrustProcess, HowItWorks, TrustBadges
    admin/           # Admin-specific components (future)
  pages/
    customer/        # 17 customer screens (Home, Catalog, Cart, Checkout, Orders, Profile, etc.)
    admin/           # 14 admin screens (Dashboard, OrdersPanel, ProductCMS, Settings, etc.)
  layouts/
    CustomerLayout.tsx   # Mobile-first with bottom tabs + center Paste Link FAB
    AdminLayout.tsx      # Desktop sidebar navigation
  context/
    AppContext.tsx   # Global state: auth, cart, notifications, orders
  data/
    mockData.ts      # All dummy data: products, orders, categories, delivery rules, etc.
  types/
    index.ts         # TypeScript types/interfaces for all entities
  utils/
    currency.ts      # Bhutan-friendly pricing: Nu. / Est. Nu. formatting
public/
  manifest.json     # PWA manifest
  icon-192.png      # PWA icon (192x192)
  icon-512.png      # PWA icon (512x512)
  hero-bhutan.jpg   # Homepage hero banner
```

## Screens

### Customer (17 screens)
Login, Register, Forgot Password, Home, Catalog, Product Detail, Paste Link, Cart, Checkout, Quotation Review, Payment Upload, My Orders, Order Tracking, Profile, Saved Addresses, Support, Notifications

### Admin (14 screens)
Dashboard, Orders Panel, Order Detail, Quotation Builder, Payments Verification, Customers Panel, Product CMS, Banner CMS, Category CMS, Delivery Fee Settings, Service Charge Settings, Payment Method Settings, App Settings, FAQ/Terms CMS

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Supabase Integration (Future)

All data access is centralized in `src/data/mockData.ts`. To connect Supabase:

1. Replace mock data imports with Supabase client queries
2. Update `AppContext` to use real auth (Supabase Auth)
3. Use `appSettings.orderCoverage` and `appSettings.deliveryHubs` for dynamic config

See [MOBILE.md](./MOBILE.md) for the native mobile app strategy.
