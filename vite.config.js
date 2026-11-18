import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    //send api calls to the express server
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
