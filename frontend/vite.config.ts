import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/jaeger-api': {
        target: 'http://localhost:16686',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jaeger-api/, ''),
      },
    },
  },
})
