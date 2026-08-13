import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Three.js is ~80% of the bundle and isn't needed until the 3D view
        // mounts. Splitting it lets the onboarding survey paint immediately and
        // keeps the big chunk cached across deploys that only touch app code.
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
