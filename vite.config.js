import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the renderer that Electron serves from nested://app (desktop/main.mjs).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Three.js is ~80% of the bundle and isn't needed until the 3D view
        // mounts. Splitting it lets the onboarding survey paint immediately.
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
