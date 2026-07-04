import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vercel serves the app from the domain root.
// Keep base as '/' so deep links like /order/:id load JS/CSS from /assets,
// not from /order/:id/assets.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
