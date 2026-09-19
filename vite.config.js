import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API routes are served by server/index.js, which also hosts Vite in dev (middleware mode).
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'charts', test: /node_modules[\\/](recharts|d3-|victory)/ }],
        },
      },
    },
  },
})
