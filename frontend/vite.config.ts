import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  base: '/cost-scraper/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-table': ['@tanstack/react-table'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          // Feature chunks  
          'feature-charts': [
            './src/components/CostCharts.tsx',
            './src/components/ChatCharts.tsx'
          ],
          'feature-chat': [
            './src/components/ChatInterface.tsx',
            './src/components/ChatBot.tsx'
          ],
        }
      }
    },
    // Chunk size warning threshold
    chunkSizeWarningLimit: 500,
    // Enable source maps for production debugging
    sourcemap: true
  }
})

