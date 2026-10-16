import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useLocalHttps = env.VITE_DEV_HTTPS === 'true'

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(useLocalHttps ? [basicSsl()] : []),
    ],
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor-firebase', test: /node_modules[\\/](?:@firebase|firebase)[\\/]/, priority: 40 },
              { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 30 },
              { name: 'vendor-react', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/, priority: 20 },
              { name: 'vendor-recharts', test: /node_modules[\\/]recharts[\\/]/, priority: 10 },
            ],
          },
        },
      },
    },
    server: {
      host: env.VITE_DEV_HOST || '127.0.0.1',
      port: 5173,
      strictPort: true,
      https: useLocalHttps,
    },
    preview: {
      host: env.VITE_DEV_HOST || '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
  }
})
