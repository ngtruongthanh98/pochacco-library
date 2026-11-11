import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages phục vụ tại https://<user>.github.io/pochacco-library/
export default defineConfig({
  base: '/pochacco-library/',
  plugins: [react()],
})
