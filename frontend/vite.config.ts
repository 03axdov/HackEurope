import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '')
  const rawBackendApiBase = env.BACKEND_API_BASE_URL || 'http://localhost:8000/api'
  const normalizedBackendApiBase = rawBackendApiBase.replace(/\/+$/, '')
  const backendApiTarget = normalizedBackendApiBase.endsWith('/api')
    ? normalizedBackendApiBase
    : `${normalizedBackendApiBase}/api`

  return {
    plugins: [react(), tailwindcss()],
    envDir: '..',
    server: {
      proxy: {
        '/jaeger-api': {
          target: 'http://localhost:16686',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jaeger-api/, ''),
        },
        '/backend-api': {
          target: backendApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/backend-api/, ''),
        },
      },
    },
  }
})
