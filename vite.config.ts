import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase'
          }
          // React and the router change only when a dependency is upgraded, while app code
          // changes every deploy. Splitting them means a deploy invalidates ~30 kB of app
          // chunk instead of ~75 kB — which is worth more now that the service worker caches
          // hashed assets indefinitely and only re-fetches filenames that actually changed.
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler') ||
            /node_modules\/react\//.test(id)
          ) {
            return 'react'
          }
        },
      },
    },
  },
})
