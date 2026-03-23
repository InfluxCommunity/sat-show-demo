import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['globe.gl', 'three', 'satellite.js']
  },
  build: {
    commonjsOptions: {
      include: [/globe\.gl/, /node_modules/]
    }
  }
})
